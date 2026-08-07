"use server";

import { createRequire } from "node:module";
import { revalidatePath } from "next/cache";
import { validateProductInput } from "@double-a/shared-types";
import { createProduct, listCategories } from "@double-a/supabase";
import { toCategoryOptions } from "@/lib/category-options";
import { getServerClient } from "@/lib/supabase/server";
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

function extractTextFromImage(mime: string, buffer: Buffer): Promise<string> {
  return new Promise((resolve, reject) => {
    textract.fromBufferWithMime(
      mime,
      buffer,
      {
        preserveLineBreaks: true,
        // Sparse notebook lines — one product per row.
        tesseract: { cmd: "-l eng --psm 6" },
      },
      (error, text) => {
        if (error) reject(error);
        else resolve(text ?? "");
      },
    );
  });
}

function describeSaveError(message: string): string {
  if (message.includes("products_sku_key")) {
    return "That SKU is already used by another product.";
  }
  if (message.includes("products_barcode_idx")) {
    return "That barcode is already on another product.";
  }
  if (message.includes("products_bulk_pair_ck")) {
    return "Bulk pricing needs both a bulk price and a minimum quantity.";
  }
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

  const supabase = await getServerClient();
  try {
    await createProduct(supabase, {
      name: input.name,
      sku: input.sku,
      price: input.price,
      cost_price: input.costPrice,
      category_id: input.categoryId,
      unit: input.unit,
      barcode: input.barcode,
      reorder_point: input.reorderPoint,
      bulk_price: input.bulkPrice,
      bulk_min_quantity: input.bulkMinQuantity,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return describeSaveError(message);
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

  const supabase = await getServerClient();
  const categories = await listCategories(supabase, { includeInactive: true });
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
