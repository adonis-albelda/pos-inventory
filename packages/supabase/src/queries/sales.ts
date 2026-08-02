import type { SaleWithItems } from "@double-a/shared-types";
import type { DoubleAClient } from "../client-browser";
import type { TablesInsert } from "../database.types";
import { toSale, toSaleItem } from "../mappers";

/**
 * The push half of sync.
 *
 * Both writes are upserts that ignore duplicates, and that is load bearing: the
 * stock trigger fires on sale_items INSERT, so a plain insert retried after a
 * partial failure would decrement the same stock twice. Ignoring conflicts makes
 * a repeated push a no-op instead.
 *
 * Headers go first — sale_items has a foreign key to sales.
 */
export async function pushSales(
  client: DoubleAClient,
  sales: TablesInsert<"sales">[],
  items: TablesInsert<"sale_items">[],
): Promise<void> {
  if (sales.length === 0) return;

  const { error: salesError } = await client
    .from("sales")
    .upsert(sales, { onConflict: "id", ignoreDuplicates: true });
  if (salesError) throw salesError;

  if (items.length === 0) return;

  const { error: itemsError } = await client
    .from("sale_items")
    .upsert(items, { onConflict: "id", ignoreDuplicates: true });
  if (itemsError) throw itemsError;
}

export interface SalesFilter {
  from?: string;
  to?: string;
  userId?: string;
  deviceId?: string;
  status?: string;
  limit?: number;
}

export async function listSales(
  client: DoubleAClient,
  filter: SalesFilter = {},
): Promise<(SaleWithItems & { cashierName: string | null })[]> {
  let query = client
    .from("sales")
    .select("*, sale_items(*), users(name)")
    .order("created_at", { ascending: false })
    .limit(filter.limit ?? 100);

  if (filter.from) query = query.gte("created_at", filter.from);
  if (filter.to) query = query.lte("created_at", filter.to);
  if (filter.userId) query = query.eq("user_id", filter.userId);
  if (filter.deviceId) query = query.eq("device_id", filter.deviceId);
  if (filter.status) query = query.eq("status", filter.status);

  const { data, error } = await query;
  if (error) throw error;

  return (data ?? []).map((row) => {
    const { sale_items: saleItems, users, ...sale } = row as typeof row & {
      sale_items: Parameters<typeof toSaleItem>[0][];
      users: { name: string } | null;
    };

    return {
      ...toSale(sale),
      items: (saleItems ?? []).map(toSaleItem),
      cashierName: users?.name ?? null,
    };
  });
}

export async function getSale(
  client: DoubleAClient,
  id: string,
): Promise<SaleWithItems | null> {
  const { data, error } = await client
    .from("sales")
    .select("*, sale_items(*)")
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const { sale_items: saleItems, ...sale } = data as typeof data & {
    sale_items: Parameters<typeof toSaleItem>[0][];
  };

  return { ...toSale(sale), items: (saleItems ?? []).map(toSaleItem) };
}

/**
 * Voiding is the only reversal path — sales are never deleted. A trigger puts
 * the stock back as a `void_restore` movement.
 */
export async function voidSale(client: DoubleAClient, id: string): Promise<void> {
  const { error } = await client
    .from("sales")
    .update({ status: "voided" })
    .eq("id", id);

  if (error) throw error;
}

/** Which of these ids the server already has, used to reconcile a device. */
export async function findExistingSaleIds(
  client: DoubleAClient,
  ids: string[],
): Promise<Set<string>> {
  if (ids.length === 0) return new Set();

  const { data, error } = await client.from("sales").select("id").in("id", ids);
  if (error) throw error;
  return new Set((data ?? []).map((row) => row.id));
}
