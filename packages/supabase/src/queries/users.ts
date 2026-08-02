import type { User } from "@double-a/shared-types";
import type { DoubleAClient } from "../client-browser";
import type { TablesInsert, TablesUpdate } from "../database.types";
import { toUser } from "../mappers";

const USER_COLUMNS = "id, name, email, role, is_active, created_at, updated_at";

export async function listUsers(
  client: DoubleAClient,
  options: { includeInactive?: boolean } = {},
): Promise<User[]> {
  let query = client.from("users").select(USER_COLUMNS).order("name");
  if (!options.includeInactive) query = query.eq("is_active", true);

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map(toUser);
}

export async function fetchUsersChangedSince(
  client: DoubleAClient,
  since: string | null,
): Promise<User[]> {
  let query = client.from("users").select(USER_COLUMNS);
  if (since) query = query.gt("updated_at", since);

  const { data, error } = await query.order("updated_at");
  if (error) throw error;
  return (data ?? []).map(toUser);
}

/**
 * PIN hashes for the cashiers this terminal may unlock. Fetched during sync and
 * stored locally so the PIN check itself never needs connectivity. Exposed as a
 * function in Postgres because pin_hash is revoked as a readable column.
 */
export async function fetchCashierPins(
  client: DoubleAClient,
): Promise<{ id: string; pinHash: string | null }[]> {
  const { data, error } = await client.rpc("cashier_pins");
  if (error) throw error;
  return (data ?? []).map((row) => ({ id: row.id, pinHash: row.pin_hash }));
}

export async function createUser(
  client: DoubleAClient,
  input: TablesInsert<"users">,
): Promise<void> {
  const { error } = await client.from("users").insert(input);
  if (error) throw error;
}

export async function updateUser(
  client: DoubleAClient,
  id: string,
  patch: TablesUpdate<"users">,
): Promise<void> {
  const { error } = await client.from("users").update(patch).eq("id", id);
  if (error) throw error;
}

export async function currentAppUser(
  client: DoubleAClient,
): Promise<User | null> {
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) return null;

  const { data, error } = await client
    .from("users")
    .select(USER_COLUMNS)
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (error) throw error;
  return data ? toUser(data) : null;
}
