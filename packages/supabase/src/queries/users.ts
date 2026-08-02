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
 * Who can unlock a terminal. Live list — unlock never reads the local users
 * table for credentials or the picker.
 */
export async function listCashiers(
  client: DoubleAClient,
): Promise<User[]> {
  const users = await listUsers(client);
  return users.filter(
    (user) => user.role === "cashier" || user.role === "admin",
  );
}

/**
 * Live PIN check. pin_hash stays on the server; the device only learns ok/fail.
 */
export async function verifyCashierPin(
  client: DoubleAClient,
  userId: string,
  pin: string,
): Promise<boolean> {
  const { data, error } = await client.rpc("verify_pin", {
    p_user_id: userId,
    p_pin: pin,
  });
  if (error) throw error;
  return Boolean(data);
}

/**
 * @deprecated Unlock uses verify_pin(); hashes are no longer pulled to devices.
 * Kept while older terminals may still call the RPC.
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
