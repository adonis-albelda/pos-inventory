"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import {
  isProductUnit,
  PRODUCT_UNITS,
  validateProductInput,
} from "@double-a/shared-types";
import { createProduct, listCategories } from "@double-a/supabase";
import { toCategoryOptions } from "@/lib/category-options";
import { getServerClient } from "@/lib/supabase/server";
import type {
  ExtractProductsResult,
  SaveAllScannedResult,
  SaveScannedResult,
  ScannedProductDraft,
} from "./types";

const OPENAI_MODEL = "gpt-4o-mini";

interface VisionProduct {
  name?: unknown;
  sku?: unknown;
  barcode?: unknown;
  price?: unknown;
  cost_price?: unknown;
  unit?: unknown;
  reorder_point?: unknown;
  bulk_price?: unknown;
  bulk_min_quantity?: unknown;
  category?: unknown;
}

function asTrimmedString(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function asOptionalNumberString(value: unknown): string {
  if (value === null || value === undefined || value === "") return "";
  const n = typeof value === "number" ? value : Number(String(value).replace(/,/g, ""));
  return Number.isFinite(n) ? String(n) : "";
}

function matchCategoryId(
  categoryText: string,
  options: { id: string; name: string; path: string }[],
): string {
  const needle = categoryText.trim().toLowerCase();
  if (!needle) return "";

  const byPath = options.find((o) => o.path.toLowerCase() === needle);
  if (byPath) return byPath.id;

  const byName = options.find((o) => o.name.toLowerCase() === needle);
  if (byName) return byName.id;

  const pathContains = options.find(
    (o) =>
      o.path.toLowerCase().includes(needle) || needle.includes(o.path.toLowerCase()),
  );
  if (pathContains) return pathContains.id;

  return "";
}

function toDraft(
  raw: VisionProduct,
  options: { id: string; name: string; path: string }[],
): ScannedProductDraft {
  const unitRaw = asTrimmedString(raw.unit).toLowerCase();
  const unit = isProductUnit(unitRaw) ? unitRaw : "pc";
  const categoryText = asTrimmedString(raw.category);

  return {
    clientId: randomUUID(),
    name: asTrimmedString(raw.name),
    sku: asTrimmedString(raw.sku),
    barcode: asTrimmedString(raw.barcode),
    price: asOptionalNumberString(raw.price),
    costPrice: asOptionalNumberString(raw.cost_price),
    categoryId: matchCategoryId(categoryText, options),
    unit,
    reorderPoint: asOptionalNumberString(raw.reorder_point) || "5",
    bulkPrice: asOptionalNumberString(raw.bulk_price),
    bulkMinQuantity: asOptionalNumberString(raw.bulk_min_quantity),
  };
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
 * Reads product lines from a notebook photo via OpenAI vision.
 * Stock is never extracted — opening stock belongs on Inventory.
 */
export async function extractProductsFromImage(
  formData: FormData,
): Promise<ExtractProductsResult> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return {
      error:
        "Server is missing OPENAI_API_KEY. Add it to apps/admin/.env.local, then restart admin.",
      drafts: [],
    };
  }

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
  const dataUrl = `data:${file.type};base64,${buffer.toString("base64")}`;

  const supabase = await getServerClient();
  const categories = await listCategories(supabase, { includeInactive: true });
  const options = toCategoryOptions(categories);
  const categoryPaths = options.map((o) => o.path).slice(0, 80);

  const systemPrompt = [
    "You extract product catalogue rows from photos of handwritten or printed lists.",
    "Return JSON only: { \"products\": [ ... ] }.",
    "Each product object may include: name, sku, barcode, price, cost_price, unit, reorder_point, bulk_price, bulk_min_quantity, category.",
    "One object per product line on the page. Skip headers, totals, and doodles.",
    "name is required when a line is a product. Prices are numbers (no currency symbols).",
    `unit must be one of: ${PRODUCT_UNITS.join(", ")}. Default to "pc" if unclear.`,
    "category is free text matching a path when readable (e.g. Plumbing / Pipes).",
    "Leave unknown fields null. Never invent stock quantities.",
    categoryPaths.length > 0
      ? `Known category paths (prefer these spellings when close): ${categoryPaths.join("; ")}.`
      : "No categories exist yet; leave category null.",
  ].join(" ");

  let response: Response;
  try {
    response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        temperature: 0.1,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Extract every product line from this photo into the products array.",
              },
              { type: "image_url", image_url: { url: dataUrl } },
            ],
          },
        ],
      }),
    });
  } catch {
    return {
      error: "Could not reach OpenAI. Check the network and try again.",
      drafts: [],
    };
  }

  if (!response.ok) {
    const body = await response.text();
    if (response.status === 401) {
      return { error: "OpenAI rejected the API key. Check OPENAI_API_KEY.", drafts: [] };
    }
    return {
      error: `OpenAI could not read the photo (${response.status}). ${body.slice(0, 180)}`,
      drafts: [],
    };
  }

  const payload = (await response.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = payload.choices?.[0]?.message?.content;
  if (!content) {
    return { error: "OpenAI returned an empty answer. Try a clearer photo.", drafts: [] };
  }

  let parsed: { products?: VisionProduct[] };
  try {
    parsed = JSON.parse(content) as { products?: VisionProduct[] };
  } catch {
    return { error: "Could not parse the product list from the photo.", drafts: [] };
  }

  const products = Array.isArray(parsed.products) ? parsed.products : [];
  const drafts = products
    .map((row) => toDraft(row, options))
    .filter((draft) => draft.name.length > 0);

  if (drafts.length === 0) {
    return {
      error:
        "No product lines found. Use a clearer photo with one product per row.",
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
