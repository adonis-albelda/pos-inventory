"use server";

import { revalidatePath } from "next/cache";
import { adjustStock, currentAppUser, type AdjustReason } from "@double-a/supabase";
import type { FormState } from "@/lib/form-state";
import { getServerClient } from "@/lib/supabase/server";

const REASONS: AdjustReason[] = ["restock", "adjustment", "oversell_correction"];

/**
 * Every stock change goes through this. It writes an inventory_movements row
 * and a trigger applies it to products.stock_quantity, so stock always equals
 * the sum of its movements.
 */
export async function moveStock(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const productId = String(formData.get("product_id") ?? "");
  const reason = String(formData.get("reason") ?? "") as AdjustReason;
  const direction = String(formData.get("direction") ?? "in");
  const magnitude = Number(formData.get("quantity") ?? 0);
  const note = String(formData.get("note") ?? "").trim();

  if (!productId) return { error: "Pick a product.", ok: false };
  if (!REASONS.includes(reason)) return { error: "Pick a reason.", ok: false };
  if (!Number.isInteger(magnitude) || magnitude < 1) {
    return { error: "Quantity must be a whole number, 1 or more.", ok: false };
  }

  const changeQuantity = direction === "out" ? -magnitude : magnitude;

  const supabase = await getServerClient();
  const actor = await currentAppUser(supabase);

  try {
    await adjustStock(supabase, {
      productId,
      changeQuantity,
      reason,
      note: note || undefined,
      createdBy: actor?.id,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return { error: `Could not record the movement: ${message}`, ok: false };
  }

  revalidatePath("/inventory");
  revalidatePath("/products");
  revalidatePath("/");
  return { error: null, ok: true };
}
