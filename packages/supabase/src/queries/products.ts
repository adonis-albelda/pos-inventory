import type { Product } from "@double-a/shared-types";
import type { DoubleAClient } from "../client-browser";
import type { TablesInsert, TablesUpdate, Views } from "../database.types";
import { toProduct } from "../mappers";
import { fetchAllPages } from "./fetch-all";

/**
 * PostgREST `or()` splits on commas. Quotes keep a SKU like "RSB AL" as one
 * pattern. `%` / `_` are LIKE wildcards — stripped so a typed search stays literal.
 */
function applyProductSearch<Query extends { or: (filters: string) => Query }>(
  query: Query,
  raw: string,
): Query {
  const needle = raw.trim().replace(/[%_"]/g, "");
  if (!needle) return query;
  const pattern = `%${needle}%`;
  return query.or(
    `name.ilike."${pattern}",sku.ilike."${pattern}",barcode.ilike."${pattern}",category.ilike."${pattern}"`,
  );
}

export async function listProducts(
  client: DoubleAClient,
  options: { includeInactive?: boolean } = {},
): Promise<Product[]> {
  return fetchAllPages(async (from, to) => {
    let query = client.from("products").select("*").order("name").order("id").range(from, to);
    if (!options.includeInactive) query = query.eq("is_active", true);
    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []).map(toProduct);
  });
}

export async function countProducts(
  client: DoubleAClient,
  options: { includeInactive?: boolean } = {},
): Promise<number> {
  let query = client.from("products").select("id", { count: "exact", head: true });
  if (!options.includeInactive) query = query.eq("is_active", true);
  const { count, error } = await query;
  if (error) throw error;
  return count ?? 0;
}

export async function listProductsPage(
  client: DoubleAClient,
  options: {
    q?: string;
    page?: number;
    pageSize?: number;
    includeInactive?: boolean;
  } = {},
): Promise<{ products: Product[]; total: number }> {
  const pageSize = options.pageSize ?? 25;
  const page = Math.max(1, options.page ?? 1);
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = client.from("products").select("*", { count: "exact" }).order("name").order("id");
  if (!options.includeInactive) query = query.eq("is_active", true);
  query = applyProductSearch(query, options.q ?? "");
  query = query.range(from, to);

  const { data, error, count } = await query;
  if (error) throw error;
  return { products: (data ?? []).map(toProduct), total: count ?? 0 };
}

export async function listProductsByIds(
  client: DoubleAClient,
  ids: string[],
): Promise<Product[]> {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return [];

  const products: Product[] = [];
  const chunk = 200;
  for (let i = 0; i < unique.length; i += chunk) {
    const slice = unique.slice(i, i + chunk);
    const { data, error } = await client.from("products").select("*").in("id", slice);
    if (error) throw error;
    products.push(...(data ?? []).map(toProduct));
  }
  return products;
}

export async function findProductIdsMatching(
  client: DoubleAClient,
  q: string,
  options: { includeInactive?: boolean } = {},
): Promise<string[]> {
  const needle = q.trim();
  if (!needle) return [];

  const rows = await fetchAllPages(async (from, to) => {
    let query = client.from("products").select("id").order("name").order("id").range(from, to);
    if (!options.includeInactive) query = query.eq("is_active", true);
    query = applyProductSearch(query, needle);
    const { data, error } = await query;
    if (error) throw error;
    return data ?? [];
  });

  return rows.map((row) => row.id);
}

/** Direct `category_id` counts. Callers that want a parent total roll these up. */
export async function countProductsByCategory(
  client: DoubleAClient,
  options: { includeInactive?: boolean } = {},
): Promise<Record<string, number>> {
  const rows = await fetchAllPages(async (from, to) => {
    let query = client.from("products").select("category_id").order("id").range(from, to);
    if (!options.includeInactive) query = query.eq("is_active", true);
    const { data, error } = await query;
    if (error) throw error;
    return data ?? [];
  });

  const counts: Record<string, number> = {};
  for (const row of rows) {
    if (!row.category_id) continue;
    counts[row.category_id] = (counts[row.category_id] ?? 0) + 1;
  }
  return counts;
}

export async function getProduct(
  client: DoubleAClient,
  id: string,
): Promise<Product | null> {
  const { data, error } = await client
    .from("products")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  return data ? toProduct(data) : null;
}

/**
 * Incremental fetch for the mobile pull step. `since` is the device's
 * last_synced_at; passing null pulls everything (first launch).
 */
export async function fetchProductsChangedSince(
  client: DoubleAClient,
  since: string | null,
): Promise<Product[]> {
  return fetchAllPages(async (from, to) => {
    let query = client.from("products").select("*").order("updated_at").order("id").range(from, to);
    if (since) query = query.gt("updated_at", since);
    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []).map(toProduct);
  });
}

export async function createProduct(
  client: DoubleAClient,
  input: TablesInsert<"products">,
): Promise<Product> {
  const { data, error } = await client
    .from("products")
    .insert(input)
    .select("*")
    .single();

  if (error) throw error;
  return toProduct(data);
}

/**
 * Note: stock_quantity is intentionally not updatable here. Stock only ever
 * moves through adjustStock(), so products.stock_quantity always equals the
 * sum of that product's inventory_movements.
 */
export async function updateProduct(
  client: DoubleAClient,
  id: string,
  patch: Omit<TablesUpdate<"products">, "stock_quantity">,
): Promise<Product> {
  const { data, error } = await client
    .from("products")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();

  if (error) throw error;
  return toProduct(data);
}

export async function setProductActive(
  client: DoubleAClient,
  id: string,
  isActive: boolean,
): Promise<void> {
  const { error } = await client
    .from("products")
    .update({ is_active: isActive })
    .eq("id", id);

  if (error) throw error;
}

/**
 * Bulk upsert for CSV import, keyed on SKU. A row without a SKU cannot be
 * matched to an existing product, so the caller must reject those first.
 */
export async function upsertProductsBySku(
  client: DoubleAClient,
  rows: TablesInsert<"products">[],
): Promise<number> {
  if (rows.length === 0) return 0;

  const { data, error } = await client
    .from("products")
    .upsert(rows, { onConflict: "sku" })
    .select("id");

  if (error) throw error;
  return data?.length ?? 0;
}

/** Everything at or under its reorder point, worst first. */
export async function listBelowReorder(
  client: DoubleAClient,
): Promise<Views<"products_below_reorder">[]> {
  return fetchAllPages(async (from, to) => {
    const { data, error } = await client
      .from("products_below_reorder")
      .select("*")
      .order("short_by", { ascending: false })
      .range(from, to);
    if (error) throw error;
    return data ?? [];
  });
}
