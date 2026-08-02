import type { Product } from "@double-a/shared-types";
import type { DoubleAClient } from "../client-browser";
import type { TablesInsert, TablesUpdate, Views } from "../database.types";
import { toProduct } from "../mappers";

export async function listProducts(
  client: DoubleAClient,
  options: { includeInactive?: boolean } = {},
): Promise<Product[]> {
  let query = client.from("products").select("*").order("name");
  if (!options.includeInactive) query = query.eq("is_active", true);

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map(toProduct);
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
  let query = client.from("products").select("*");
  if (since) query = query.gt("updated_at", since);

  const { data, error } = await query.order("updated_at");
  if (error) throw error;
  return (data ?? []).map(toProduct);
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
  const { data, error } = await client
    .from("products_below_reorder")
    .select("*")
    .order("short_by", { ascending: false });

  if (error) throw error;
  return data ?? [];
}
