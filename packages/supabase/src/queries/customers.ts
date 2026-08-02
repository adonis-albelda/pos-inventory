import type { Customer } from "@double-a/shared-types";
import type { DoubleAClient } from "../client-browser";
import type { TablesInsert, TablesUpdate } from "../database.types";
import { toCustomer } from "../mappers";

/**
 * Every customer the office or a terminal has recorded. Pulled whole to the
 * POS (like categories): the table stays small, and a wholesale fetch is how a
 * deleted customer leaves a device.
 */
export async function listCustomers(client: DoubleAClient): Promise<Customer[]> {
  const { data, error } = await client
    .from("customers")
    .select("*")
    .order("name");

  if (error) throw error;
  return (data ?? []).map(toCustomer);
}

export async function getCustomer(
  client: DoubleAClient,
  id: string,
): Promise<Customer | null> {
  const { data, error } = await client
    .from("customers")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  return data ? toCustomer(data) : null;
}

export async function createCustomer(
  client: DoubleAClient,
  input: TablesInsert<"customers">,
): Promise<Customer> {
  const { data, error } = await client
    .from("customers")
    .insert(input)
    .select("*")
    .single();

  if (error) throw error;
  return toCustomer(data);
}

export async function updateCustomer(
  client: DoubleAClient,
  id: string,
  patch: TablesUpdate<"customers">,
): Promise<Customer> {
  const { data, error } = await client
    .from("customers")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();

  if (error) throw error;
  return toCustomer(data);
}

export async function deleteCustomer(
  client: DoubleAClient,
  id: string,
): Promise<void> {
  const { error } = await client.from("customers").delete().eq("id", id);
  if (error) throw error;
}

/**
 * Push half for customers created or edited on a device. Upsert keyed on id so
 * a retried sync is a no-op rather than a duplicate.
 */
export async function pushCustomers(
  client: DoubleAClient,
  rows: TablesInsert<"customers">[],
): Promise<void> {
  if (rows.length === 0) return;

  const { error } = await client
    .from("customers")
    .upsert(rows, { onConflict: "id" });
  if (error) throw error;
}
