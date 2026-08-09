"use server";

import { revalidatePath } from "next/cache";
import { isValidQuantity, QUANTITY_DECIMALS } from "@double-a/shared-types";
import {
  adjustStock,
  currentAppUser,
  getProduct,
  type AdjustReason,
} from "@double-a/supabase";

function roundQuantity(value: number): number {
  return Number(value.toFixed(QUANTITY_DECIMALS));
}
import type { FormState } from "@/lib/form-state";
import { getServerClient } from "@/lib/supabase/server";

const REASONS: AdjustReason[] = ["restock", "adjustment", "oversell_correction"];
const MODES = ["in", "out", "count"] as const;
type Mode = (typeof MODES)[number];

/**
 * Every stock change goes through this. It writes an inventory_movements row
 * and a trigger applies it to products.stock_quantity, so stock always equals
 * the sum of its movements.
 *
 * Three ways in: add units, remove units, or state the counted total after a
 * stock take. A count is still recorded as the difference — the movement row is
 * the fact, the count is only how the number was arrived at, and the difference
 * is worked out here against the server's stock rather than against whatever the
 * browser was last told.
 */
export async function moveStock(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const productId = String(formData.get("product_id") ?? "");
  const reason = String(formData.get("reason") ?? "") as AdjustReason;
  const rawMode = String(formData.get("mode") ?? "in");
  const mode: Mode = (MODES as readonly string[]).includes(rawMode)
    ? (rawMode as Mode)
    : "in";
  const rawMagnitude = Number(formData.get("quantity") ?? Number.NaN);
  const note = String(formData.get("note") ?? "").trim();

  if (!productId) return { error: "Pick a product.", ok: false };
  if (!REASONS.includes(reason)) return { error: "Pick a reason.", ok: false };

  const supabase = await getServerClient();
  const actor = await currentAppUser(supabase);

  // The product's decimal mode decides whether a fraction is allowed here, so
  // it is always fetched — count mode needs its stock anyway.
  const product = await getProduct(supabase, productId);
  if (!product) return { error: "That product no longer exists.", ok: false };

  const floor = mode === "count" ? 0 : product.allowDecimal ? 0.001 : 1;
  const magnitude = roundQuantity(rawMagnitude);
  if (!isValidQuantity(magnitude, product.allowDecimal, floor)) {
    const wholeOnly = product.allowDecimal ? "" : " whole";
    return {
      error:
        mode === "count"
          ? `Counted quantity must be a${wholeOnly} number, 0 or more.`
          : `Quantity must be a${wholeOnly} number greater than zero.`,
      ok: false,
    };
  }

  let changeQuantity = mode === "out" ? -magnitude : magnitude;
  let movementNote = note;

  if (mode === "count") {
    changeQuantity = roundQuantity(magnitude - product.stockQuantity);
    if (changeQuantity === 0) {
      return {
        error: `The count matches what is recorded (${product.stockQuantity}). Nothing to record.`,
        ok: false,
      };
    }

    const counted = `Counted ${magnitude}, was ${product.stockQuantity}`;
    movementNote = note ? `${counted}. ${note}` : counted;
  }

  try {
    await adjustStock(supabase, {
      productId,
      changeQuantity,
      reason,
      note: movementNote || undefined,
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
