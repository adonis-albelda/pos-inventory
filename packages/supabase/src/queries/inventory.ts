import type { InventoryMovement } from "@double-a/shared-types";
import type { DoubleAClient } from "../client-browser";
import type { Views } from "../database.types";
import { toInventoryMovement } from "../mappers";

export type AdjustReason = "restock" | "adjustment" | "oversell_correction";

/**
 * The only way stock ever changes from the admin side. Writes a movement row;
 * a trigger applies it to products.stock_quantity.
 */
export async function adjustStock(
  client: DoubleAClient,
  input: {
    productId: string;
    changeQuantity: number;
    reason: AdjustReason;
    note?: string;
    createdBy?: string;
  },
): Promise<void> {
  const { error } = await client.rpc("adjust_stock", {
    p_product_id: input.productId,
    p_change_quantity: input.changeQuantity,
    p_reason: input.reason,
    p_note: input.note ?? null,
    p_created_by: input.createdBy ?? null,
  });

  if (error) throw error;
}

export async function listMovements(
  client: DoubleAClient,
  options: { productId?: string; limit?: number } = {},
): Promise<InventoryMovement[]> {
  let query = client
    .from("inventory_movements")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(options.limit ?? 100);

  if (options.productId) query = query.eq("product_id", options.productId);

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map(toInventoryMovement);
}

/**
 * Negative stock, which is what an oversell looks like after two offline
 * devices both sold the last unit. Flagged for manual resolution rather than
 * prevented.
 */
export async function listOversold(
  client: DoubleAClient,
): Promise<Views<"oversold_products">[]> {
  const { data, error } = await client
    .from("oversold_products")
    .select("*")
    .order("oversold_by", { ascending: false });

  if (error) throw error;
  return data ?? [];
}
