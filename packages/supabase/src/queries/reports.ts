import type { DoubleAClient } from "../client-browser";
import type { Database } from "../database.types";

/**
 * Every report is a Postgres function, never a fetch-then-reduce in the app.
 * A report has to see every row in the range, and the client only ever fetches
 * a page.
 *
 * All of these throw for a non-admin: supplier cost and margin are the owner's
 * business, and the check lives in the database rather than in a route guard.
 */

type Fn = Database["public"]["Functions"];

export type ProfitRow = Fn["report_profit"]["Returns"][number];
export type TopProductRow = Fn["report_top_products"]["Returns"][number];
export type DiscountRow = Fn["report_discounts"]["Returns"][number];
export type CashierRow = Fn["report_by_cashier"]["Returns"][number];
export type DeviceRow = Fn["report_by_device"]["Returns"][number];
export type ValuationRow = Fn["report_inventory_valuation"]["Returns"][number];
export type DeadStockRow = Fn["report_dead_stock"]["Returns"][number];

export interface DateRange {
  /** Inclusive ISO timestamp. */
  from: string;
  /** Exclusive ISO timestamp. */
  to: string;
}

export async function reportProfit(
  client: DoubleAClient,
  range: DateRange,
): Promise<ProfitRow[]> {
  const { data, error } = await client.rpc("report_profit", {
    p_from: range.from,
    p_to: range.to,
  });

  if (error) throw error;
  return data ?? [];
}

export async function reportTopProducts(
  client: DoubleAClient,
  range: DateRange,
  limit = 20,
): Promise<TopProductRow[]> {
  const { data, error } = await client.rpc("report_top_products", {
    p_from: range.from,
    p_to: range.to,
    p_limit: limit,
  });

  if (error) throw error;
  return data ?? [];
}

export async function reportDiscounts(
  client: DoubleAClient,
  range: DateRange,
): Promise<DiscountRow[]> {
  const { data, error } = await client.rpc("report_discounts", {
    p_from: range.from,
    p_to: range.to,
  });

  if (error) throw error;
  return data ?? [];
}

export async function reportByCashier(
  client: DoubleAClient,
  range: DateRange,
): Promise<CashierRow[]> {
  const { data, error } = await client.rpc("report_by_cashier", {
    p_from: range.from,
    p_to: range.to,
  });

  if (error) throw error;
  return data ?? [];
}

export async function reportByDevice(
  client: DoubleAClient,
  range: DateRange,
): Promise<DeviceRow[]> {
  const { data, error } = await client.rpc("report_by_device", {
    p_from: range.from,
    p_to: range.to,
  });

  if (error) throw error;
  return data ?? [];
}

export async function reportInventoryValuation(
  client: DoubleAClient,
): Promise<ValuationRow[]> {
  const { data, error } = await client.rpc("report_inventory_valuation", {});
  if (error) throw error;
  return data ?? [];
}

export async function reportDeadStock(
  client: DoubleAClient,
  days = 60,
): Promise<DeadStockRow[]> {
  const { data, error } = await client.rpc("report_dead_stock", { p_days: days });
  if (error) throw error;
  return data ?? [];
}

/** Totals for the profit report's header cards. */
export function summariseProfit(rows: ProfitRow[]) {
  const revenue = rows.reduce((sum, row) => sum + Number(row.revenue), 0);
  const cost = rows.reduce((sum, row) => sum + Number(row.cost), 0);
  const discount = rows.reduce((sum, row) => sum + Number(row.discount), 0);
  const salesCount = rows.reduce((sum, row) => sum + Number(row.sales_count), 0);
  const itemsSold = rows.reduce((sum, row) => sum + Number(row.items_sold), 0);
  const grossProfit = revenue - cost;

  return {
    revenue,
    cost,
    discount,
    salesCount,
    itemsSold,
    grossProfit,
    marginPercent: revenue === 0 ? 0 : Math.round((grossProfit / revenue) * 1000) / 10,
  };
}
