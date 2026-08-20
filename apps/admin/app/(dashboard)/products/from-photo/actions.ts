"use server";

import { createRequire } from "node:module";
import { revalidatePath } from "next/cache";
import { validateProductInput } from "@double-a/shared-types";
import { createProduct, listCategories } from "@double-a/api-client/queries";
import { ApiError } from "@double-a/api-client";
import { toCategoryOptions } from "@/lib/category-options";
import { getAuthedClient } from "@/lib/api/session";
import { parseOcrProductLines } from "./parse-ocr-lines";
import type {
  ExtractProductsResult,
  SaveAllScannedResult,
  SaveScannedResult,
  ScannedProductDraft,
} from "./types";

const require = createRequire(import.meta.url);

type TextractConfig = {
  preserveLineBreaks?: boolean;
  tesseract?: { lang?: string; cmd?: string };
};

type TextractModule = {
  fromBufferWithMime: (
    type: string,
    buffer: Buffer,
    config: TextractConfig,
    callback: (error: Error | null, text?: string) => void,
  ) => void;
};

const textract = require("textract") as TextractModule;

const OCR_TIMEOUT_MS = 45_000;

function extractTextFromImage(mime: string, buffer: Buffer): Promise<string> {
  return new Promise((resolve, reject) => {
    let settled = false;

    // textract spawns tesseract; if that never calls back, don't hang the
    // request (and the button) forever.
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(new Error("OCR timed out. Try a smaller, clearer photo."));
    }, OCR_TIMEOUT_MS);

    textract.fromBufferWithMime(
      mime,
      buffer,
      {
        preserveLineBreaks: true,
        // Sparse notebook lines — one product per row.
        tesseract: { cmd: "-l eng --psm 6" },
      },
      (error, text) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (error) reject(error);
        else resolve(text ?? "");
      },
    );
  });
}

// Old Postgres constraint names never reach the client through the Laravel
// API — validation now comes back as per-field messages on ApiError.errors.
function describeSaveError(error: unknown): string {
  if (error instanceof ApiError && error.isValidation) {
    if (error.errors?.sku) return "That SKU is already used by another product.";
    if (error.errors?.barcode) return "That barcode is already on another product.";
    if (error.errors?.bulk_price || error.errors?.bulk_min_quantity) {
      return "Bulk pricing needs both a bulk price and a minimum quantity.";
    }
    const first = Object.values(error.errors ?? {})[0]?.[0];
    if (first) return first;
  }
  const message = error instanceof Error ? error.message : "Unknown error";
  return `Could not save the product: ${message}`;
}

function describeOcrError(message: string): string {
  const lower = message.toLowerCase();
  if (
    lower.includes("tesseract") ||
    lower.includes("enoent") ||
    lower.includes("not found") ||
    lower.includes("spawn")
  ) {
    return "Tesseract OCR is not installed. Install it (e.g. `brew install tesseract`), then restart admin.";
  }
  return `Could not read the photo: ${message}`;
}

function draftToInput(draft: ScannedProductDraft) {
  const optionalNumber = (raw: string): number | null =>
    raw.trim() === "" ? null : Number(raw);

  return {
    name: draft.name.trim(),
    sku: draft.sku.trim() || null,
    price: Number(draft.price || 0),
    costPrice: Number(draft.costPrice || 0),
    categoryId: draft.categoryId.trim() || null,
    unit: draft.unit.trim() || "pc",
    barcode: draft.barcode.trim() || null,
    reorderPoint: Number(draft.reorderPoint || 0),
    bulkPrice: optionalNumber(draft.bulkPrice),
    bulkMinQuantity: optionalNumber(draft.bulkMinQuantity),
  };
}

async function insertDraft(draft: ScannedProductDraft): Promise<string | null> {
  const input = draftToInput(draft);
  const validation = validateProductInput(input);
  if (!validation.ok) return validation.errors.join(" ");

  const client = getAuthedClient();
  try {
    await createProduct(client, {
      name: input.name,
      sku: input.sku,
      price: input.price,
      costPrice: input.costPrice,
      categoryId: input.categoryId,
      unit: input.unit,
      barcode: input.barcode,
      reorderPoint: input.reorderPoint,
      bulkPrice: input.bulkPrice,
      bulkMinQuantity: input.bulkMinQuantity,
    });
  } catch (error) {
    return describeSaveError(error);
  }

  return null;
}

/**
 * Reads product lines from a notebook photo via textract (Tesseract OCR).
 * Stock is never extracted — opening stock belongs on Inventory.
 */
export async function extractProductsFromImage(
  formData: FormData,
): Promise<ExtractProductsResult> {
  const file = formData.get("image");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Choose a photo, or take one with the camera.", drafts: [] };
  }

  if (!file.type.startsWith("image/")) {
    return { error: "That file is not an image.", drafts: [] };
  }

  // Phone JPEGs can be several MB; refuse anything that will blow the body limit.
  if (file.size > 5.5 * 1024 * 1024) {
    return {
      error: "Photo is too large (over 5.5 MB). Try a clearer, smaller shot.",
      drafts: [],
    };
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const mime = file.type || "image/jpeg";

  let text: string;
  try {
    text = await extractTextFromImage(mime, buffer);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return { error: describeOcrError(message), drafts: [] };
  }

  if (!text.trim()) {
    return {
      error:
        "No text found in the photo. Use a clearer shot with one product per line.",
      drafts: [],
    };
  }

  const client = getAuthedClient();
  const categories = await listCategories(client, { includeInactive: true });
  const options = toCategoryOptions(categories);

  const drafts = parseOcrProductLines(text, options);

  if (drafts.length === 0) {
    return {
      error:
        "No product lines found. Use a clearer photo with one product per row (name and price).",
      drafts: [],
    };
  }

  return { error: null, drafts };
}

export async function saveScannedProduct(
  draft: ScannedProductDraft,
): Promise<SaveScannedResult> {
  const error = await insertDraft(draft);
  if (error) return { error, ok: false, clientId: draft.clientId };

  revalidatePath("/products");
  revalidatePath("/inventory");
  revalidatePath("/reports");
  revalidatePath("/products/from-photo");
  return { error: null, ok: true, clientId: draft.clientId };
}

export async function saveAllScannedProducts(
  drafts: ScannedProductDraft[],
): Promise<SaveAllScannedResult> {
  if (drafts.length === 0) {
    return { error: "Nothing to save.", saved: 0, failures: [] };
  }

  const failures: { clientId: string; error: string }[] = [];
  let saved = 0;

  for (const draft of drafts) {
    const error = await insertDraft(draft);
    if (error) {
      failures.push({ clientId: draft.clientId, error });
    } else {
      saved += 1;
    }
  }

  if (saved > 0) {
    revalidatePath("/products");
    revalidatePath("/inventory");
    revalidatePath("/reports");
    revalidatePath("/products/from-photo");
  }

  return {
    error:
      failures.length === 0
        ? null
        : saved === 0
          ? "Nothing was saved. Fix the rows marked below."
          : `Saved ${saved}. ${failures.length} still need a fix.`,
    saved,
    failures,
  };
}
