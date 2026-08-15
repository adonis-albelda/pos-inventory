import type { User } from "@double-a/shared-types";
import type { DoubleAClient } from "../client-browser";
import type { TablesInsert, TablesUpdate } from "../database.types";
import { toUser } from "../mappers";

const USER_COLUMNS =
  "id, name, email, role, is_active, can_sell, must_change_password, company_id, created_at, updated_at";

export async function listUsers(
  client: DoubleAClient,
  options: { includeInactive?: boolean } = {},
): Promise<User[]> {
  let query = client
    .from("users")
    .select(USER_COLUMNS)
    .neq("role", "superadmin")
    .order("name");
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
 * What the server thinks this session is: 'admin', 'device', 'cashier', or null
 * when the Auth user has no active `public.users` row. Null is the case worth
 * naming — reads still work under `using (true)` policies, so a terminal can
 * look enrolled while every write and every `verify_pin()` silently fails.
 */
export async function currentAppRole(
  client: DoubleAClient,
): Promise<string | null> {
  const { data, error } = await client.rpc("current_app_role");
  if (error) throw error;
  return data ?? null;
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
  // getSession is local. getUser() hits the network and can return null on
  // React Native after a good sign-in, which setup then mislabels as "no
  // staff record".
  const {
    data: { session },
  } = await client.auth.getSession();
  if (!session) return null;

  // auth_user_id is not selectable by authenticated clients. This RPC resolves
  // the row as security definer, same idea as current_app_role().
  const { data, error } = await client.rpc("current_app_user");
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return row ? toUser(row) : null;
}
