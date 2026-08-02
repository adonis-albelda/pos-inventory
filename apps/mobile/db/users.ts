import type { User } from "@double-a/shared-types";
import { getDb } from "./index";

interface UserRow {
  id: string;
  name: string;
  email: string | null;
  role: string;
  pin_hash: string | null;
  is_active: number;
  updated_at: string | null;
}

function toLocalUser(row: UserRow): User {
  return {
    id: row.id,
    name: row.name,
    email: row.email ?? "",
    role: row.role as User["role"],
    isActive: row.is_active === 1,
    updatedAt: row.updated_at ?? "",
  };
}

/** Who can unlock this terminal. Terminal accounts themselves are excluded. */
export async function listCashiers(): Promise<User[]> {
  const rows = await getDb().getAllAsync<UserRow>(
    `SELECT * FROM users
      WHERE is_active = 1 AND role IN ('cashier', 'admin')
      ORDER BY name`,
  );
  return rows.map(toLocalUser);
}

export async function getStoredPinHash(userId: string): Promise<string | null> {
  const row = await getDb().getFirstAsync<{ pin_hash: string | null }>(
    "SELECT pin_hash FROM users WHERE id = ?",
    userId,
  );
  return row?.pin_hash ?? null;
}

export async function getLocalUser(userId: string): Promise<User | null> {
  const row = await getDb().getFirstAsync<UserRow>(
    "SELECT * FROM users WHERE id = ?",
    userId,
  );
  return row ? toLocalUser(row) : null;
}

export async function upsertUsers(
  users: User[],
  pinHashes: Map<string, string | null>,
): Promise<void> {
  if (users.length === 0) return;

  const db = getDb();
  await db.withTransactionAsync(async () => {
    for (const user of users) {
      await db.runAsync(
        `INSERT INTO users (id, name, email, role, pin_hash, is_active, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT (id) DO UPDATE SET
           name = excluded.name,
           email = excluded.email,
           role = excluded.role,
           is_active = excluded.is_active,
           updated_at = excluded.updated_at,
           -- keep the existing hash when the pull did not include one, so a
           -- cashier can still unlock after a partial sync
           pin_hash = COALESCE(excluded.pin_hash, users.pin_hash)`,
        user.id,
        user.name,
        user.email,
        user.role,
        pinHashes.get(user.id) ?? null,
        user.isActive ? 1 : 0,
        user.updatedAt,
      );
    }
  });
}

export async function countLocalUsers(): Promise<number> {
  const row = await getDb().getFirstAsync<{ count: number }>(
    "SELECT COUNT(*) AS count FROM users",
  );
  return row?.count ?? 0;
}
