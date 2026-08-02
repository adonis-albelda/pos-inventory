import type { User } from "@double-a/shared-types";
import { getDb } from "./index";

/**
 * Local users mirror for sale attribution after unlock. Credentials never
 * checked here — unlock uses live verify_pin.
 */
export async function upsertUsers(users: User[]): Promise<void> {
  if (users.length === 0) return;

  const db = getDb();
  await db.withTransactionAsync(async () => {
    for (const user of users) {
      await db.runAsync(
        `INSERT INTO users (id, name, email, role, pin_hash, is_active, updated_at)
         VALUES (?, ?, ?, ?, NULL, ?, ?)
         ON CONFLICT (id) DO UPDATE SET
           name = excluded.name,
           email = excluded.email,
           role = excluded.role,
           is_active = excluded.is_active,
           updated_at = excluded.updated_at`,
        user.id,
        user.name,
        user.email,
        user.role,
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
