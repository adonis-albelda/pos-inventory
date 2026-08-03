import type { InventoryMovement, InventoryReason } from "@double-a/shared-types";
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
    /** A purchase order for a receiving-driven restock; null for hand entries. */
    referenceId?: string;
  },
): Promise<void> {
  const { error } = await client.rpc("adjust_stock", {
    p_product_id: input.productId,
    p_change_quantity: input.changeQuantity,
    p_reason: input.reason,
    p_note: input.note ?? null,
    p_created_by: input.createdBy ?? null,
    p_reference_id: input.referenceId ?? null,
  });

  if (error) throw error;
}

export interface MovementFilter {
  productId?: string;
  /** Narrow to a set of products — how a name search reaches this table. */
  productIds?: string[];
  /** The sale a movement came from, for the stock effect of one receipt. */
  referenceId?: string;
  reasons?: InventoryReason[];
  /** Inclusive instant. */
  from?: string;
  /** Exclusive instant. */
  to?: string;
}

export async function listMovements(
  client: DoubleAClient,
  options: MovementFilter & { limit?: number } = {},
): Promise<InventoryMovement[]> {
  let query = client
    .from("inventory_movements")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(options.limit ?? 100);

  if (options.productId) query = query.eq("product_id", options.productId);
  if (options.productIds) query = query.in("product_id", options.productIds);
  if (options.referenceId) query = query.eq("reference_id", options.referenceId);
  if (options.reasons?.length) query = query.in("reason", options.reasons);
  if (options.from) query = query.gte("created_at", options.from);
  if (options.to) query = query.lt("created_at", options.to);

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map(toInventoryMovement);
}

/**
 * One page of movement history plus the total the filter matches, so the table
 * can page without pulling every row a busy shop has ever recorded.
 */
export async function listMovementsPage(
  client: DoubleAClient,
  options: MovementFilter & { limit: number; offset?: number },
): Promise<{ movements: InventoryMovement[]; total: number }> {
  const offset = options.offset ?? 0;
  let query = client
    .from("inventory_movements")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(offset, offset + options.limit - 1);

  if (options.productId) query = query.eq("product_id", options.productId);
  if (options.productIds) query = query.in("product_id", options.productIds);
  if (options.referenceId) query = query.eq("reference_id", options.referenceId);
  if (options.reasons?.length) query = query.in("reason", options.reasons);
  if (options.from) query = query.gte("created_at", options.from);
  if (options.to) query = query.lt("created_at", options.to);

  const { data, error, count } = await query;
  if (error) throw error;
  return { movements: (data ?? []).map(toInventoryMovement), total: count ?? 0 };
}

export interface MovementTotals {
  /** Units added: restocks, corrections up, voided sales coming back. */
  stockIn: number;
  /** Units taken out, as a positive number. */
  stockOut: number;
  net: number;
  count: number;
}

/**
 * Totals across everything the filter matches, not just the visible page.
 * Postgres has no aggregate exposed for this table, so it sums client-side;
 * the cap keeps a wide range from turning into an unbounded download.
 */
export async function sumMovements(
  client: DoubleAClient,
  options: MovementFilter & { cap?: number } = {},
): Promise<MovementTotals> {
  let query = client
    .from("inventory_movements")
    .select("change_quantity")
    .order("created_at", { ascending: false })
    .limit(options.cap ?? 20000);

  if (options.productId) query = query.eq("product_id", options.productId);
  if (options.productIds) query = query.in("product_id", options.productIds);
  if (options.referenceId) query = query.eq("reference_id", options.referenceId);
  if (options.reasons?.length) query = query.in("reason", options.reasons);
  if (options.from) query = query.gte("created_at", options.from);
  if (options.to) query = query.lt("created_at", options.to);

  const { data, error } = await query;
  if (error) throw error;

  const rows = data ?? [];
  const stockIn = rows.reduce((sum, row) => sum + Math.max(0, row.change_quantity), 0);
  const stockOut = rows.reduce((sum, row) => sum + Math.max(0, -row.change_quantity), 0);

  return { stockIn, stockOut, net: stockIn - stockOut, count: rows.length };
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
