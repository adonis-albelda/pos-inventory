"use server";

import { revalidatePath } from "next/cache";
import { validateProductInput } from "@double-a/shared-types";
import { createProduct, setProductActive, updateProduct } from "@double-a/supabase";
import type { FormState } from "@/lib/form-state";
import { getServerClient } from "@/lib/supabase/server";

function text(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

/** An empty box means "not set", never zero. */
function optionalNumber(formData: FormData, key: string): number | null {
  const raw = text(formData, key);
  return raw === "" ? null : Number(raw);
}

function readProductForm(formData: FormData) {
  return {
    name: text(formData, "name"),
    sku: text(formData, "sku") || null,
    price: Number(formData.get("price") ?? 0),
    costPrice: Number(formData.get("cost_price") ?? 0),
    categoryId: text(formData, "category_id") || null,
    unit: text(formData, "unit") || "pc",
    allowDecimal: formData.get("allow_decimal") != null,
    barcode: text(formData, "barcode") || null,
    reorderPoint: Number(formData.get("reorder_point") ?? 0),
    // The two bulk fields live or die together, so an empty pair is two nulls
    // rather than a price with no minimum that would never apply.
    bulkPrice: optionalNumber(formData, "bulk_price"),
    bulkMinQuantity: optionalNumber(formData, "bulk_min_quantity"),
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

export async function saveProduct(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const id = String(formData.get("id") ?? "");
  const input = readProductForm(formData);

  const validation = validateProductInput(input);
  if (!validation.ok) {
    return { error: validation.errors.join(" "), ok: false };
  }

  // products.category is the flattened path text and belongs to a trigger.
  // Only the link is ever written from here.
  const row = {
    name: input.name,
    sku: input.sku,
    price: input.price,
    cost_price: input.costPrice,
    category_id: input.categoryId,
    unit: input.unit,
    allow_decimal: input.allowDecimal,
    barcode: input.barcode,
    reorder_point: input.reorderPoint,
    bulk_price: input.bulkPrice,
    bulk_min_quantity: input.bulkMinQuantity,
  };

  const supabase = await getServerClient();

  try {
    if (id) {
      // stock_quantity is deliberately absent: stock only moves through the
      // inventory page, which writes a movement row the trigger applies.
      await updateProduct(supabase, id, row);
    } else {
      await createProduct(supabase, row);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return { error: describeSaveError(message), ok: false };
  }

  revalidatePath("/products");
  revalidatePath("/inventory");
  revalidatePath("/reports");
  return { error: null, ok: true };
}

export async function toggleProductActive(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  const isActive = String(formData.get("is_active") ?? "") === "true";

  const supabase = await getServerClient();
  await setProductActive(supabase, id, isActive);

  revalidatePath("/products");
  revalidatePath("/inventory");
}
