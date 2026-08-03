import type { Supplier, SupplierProduct } from "@double-a/shared-types";
import type { DoubleAClient } from "../client-browser";
import type { TablesInsert, TablesUpdate } from "../database.types";
import { toSupplier } from "../mappers";

export async function listSuppliers(
  client: DoubleAClient,
  options: { includeInactive?: boolean } = {},
): Promise<Supplier[]> {
  let query = client.from("suppliers").select("*").order("name");
  if (!options.includeInactive) query = query.eq("is_active", true);

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map(toSupplier);
}

export async function getSupplier(
  client: DoubleAClient,
  id: string,
): Promise<Supplier | null> {
  const { data, error } = await client
    .from("suppliers")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  return data ? toSupplier(data) : null;
}

export async function createSupplier(
  client: DoubleAClient,
  input: TablesInsert<"suppliers">,
): Promise<Supplier> {
  const { data, error } = await client
    .from("suppliers")
    .insert(input)
    .select("*")
    .single();

  if (error) throw error;
  return toSupplier(data);
}

export async function updateSupplier(
  client: DoubleAClient,
  id: string,
  patch: TablesUpdate<"suppliers">,
): Promise<Supplier> {
  const { data, error } = await client
    .from("suppliers")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();

  if (error) throw error;
  return toSupplier(data);
}

/**
 * Blocked by `purchase_orders.supplier_id` being `on delete restrict` once the
 * supplier has any order history — the database enforces it, this just lets
 * that error surface as a normal thrown error to the caller.
 */
export async function deleteSupplier(
  client: DoubleAClient,
  id: string,
): Promise<void> {
  const { error } = await client.from("suppliers").delete().eq("id", id);
  if (error) throw error;
}

/** What a supplier is known to carry — a convenience list, not a restriction. */
export async function listSupplierProducts(
  client: DoubleAClient,
  supplierId: string,
): Promise<SupplierProduct[]> {
  const { data, error } = await client
    .from("supplier_products")
    .select("product_id, products(name)")
    .eq("supplier_id", supplierId);

  if (error) throw error;

  return (data ?? []).map((row) => {
    const { product_id: productId, products } = row as typeof row & {
      products: { name: string } | null;
    };
    return { productId, productName: products?.name ?? "—" };
  });
}

/**
 * Replaces the full link set for a supplier — simplest form that matches how
 * the form submits ("here is the whole checked list"), same delete-then-insert
 * idea as the category tree replacing itself whole on every pull.
 */
export async function setSupplierProducts(
  client: DoubleAClient,
  supplierId: string,
  productIds: string[],
): Promise<void> {
  const { error: deleteError } = await client
    .from("supplier_products")
    .delete()
    .eq("supplier_id", supplierId);
  if (deleteError) throw deleteError;

  if (productIds.length === 0) return;

  const { error: insertError } = await client.from("supplier_products").insert(
    productIds.map((productId) => ({ supplier_id: supplierId, product_id: productId })),
  );
  if (insertError) throw insertError;
}

/**
 * Unpaid installment terms across a supplier's non-cancelled purchase orders —
 * a query, never a stored column (see purchase_order_payments).
 */
export async function supplierBalance(
  client: DoubleAClient,
  supplierId: string,
): Promise<number> {
  const { data, error } = await client
    .from("purchase_order_payments")
    .select("amount, purchase_orders!inner(supplier_id, status)")
    .eq("purchase_orders.supplier_id", supplierId)
    .neq("purchase_orders.status", "cancelled")
    .eq("is_paid", false);

  if (error) throw error;
  return (data ?? []).reduce((sum, row) => sum + Number(row.amount), 0);
}

/**
 * Every supplier's linked product ids in one round trip, keyed by supplier —
 * how the suppliers list pre-checks each edit form's product list.
 */
export async function listAllSupplierProductIds(
  client: DoubleAClient,
): Promise<Record<string, string[]>> {
  const { data, error } = await client
    .from("supplier_products")
    .select("supplier_id, product_id");
  if (error) throw error;

  const byId: Record<string, string[]> = {};
  for (const row of data ?? []) {
    (byId[row.supplier_id] ??= []).push(row.product_id);
  }
  return byId;
}

/** Every supplier's unpaid balance in one round trip — the suppliers list column. */
export async function listSupplierBalances(
  client: DoubleAClient,
): Promise<Record<string, number>> {
  const { data, error } = await client
    .from("purchase_order_payments")
    .select("amount, purchase_orders!inner(supplier_id, status)")
    .neq("purchase_orders.status", "cancelled")
    .eq("is_paid", false);

  if (error) throw error;

  const byId: Record<string, number> = {};
  for (const row of (data ?? []) as {
    amount: number;
    purchase_orders: { supplier_id: string };
  }[]) {
    const supplierId = row.purchase_orders.supplier_id;
    byId[supplierId] = (byId[supplierId] ?? 0) + Number(row.amount);
  }
  return byId;
}
