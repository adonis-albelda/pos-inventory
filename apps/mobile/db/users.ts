import type { User } from "@double-a/shared-types";
import type { WriteProgress } from "./products";
import { getDb } from "./index";

async function insertOrReplaceUser(db: ReturnType<typeof getDb>, user: User): Promise<void> {
  await db.runAsync(
    `INSERT INTO users (id, name, email, role, pin_hash, is_active, can_sell, updated_at)
     VALUES (?, ?, ?, ?, NULL, ?, ?, ?)
     ON CONFLICT (id) DO UPDATE SET
       name = excluded.name,
       email = excluded.email,
       role = excluded.role,
       is_active = excluded.is_active,
       can_sell = excluded.can_sell,
       updated_at = excluded.updated_at`,
    user.id,
    user.name,
    user.email,
    user.role,
    user.isActive ? 1 : 0,
    user.canSell ? 1 : 0,
    user.updatedAt,
  );
}

/**
 * Local users mirror for sale attribution after unlock. Credentials never
 * checked here — unlock uses live verify_pin.
 */
export async function upsertUsers(users: User[], onProgress?: WriteProgress): Promise<void> {
  if (users.length === 0) return;

  const db = getDb();
  await db.withTransactionAsync(async () => {
    for (const [index, user] of users.entries()) {
      await insertOrReplaceUser(db, user);
      onProgress?.(index + 1, users.length);
    }
  });
}

/** Wholesale replace — same "Replace everything" action as replaceProducts(). */
export async function replaceUsers(users: User[], onProgress?: WriteProgress): Promise<void> {
  const db = getDb();
  await db.withTransactionAsync(async () => {
    await db.execAsync("DELETE FROM users;");
    for (const [index, user] of users.entries()) {
      await insertOrReplaceUser(db, user);
      onProgress?.(index + 1, users.length);
    }
  });
}

export async function countLocalUsers(): Promise<number> {
  const row = await getDb().getFirstAsync<{ count: number }>(
    "SELECT COUNT(*) AS count FROM users",
  );
  return row?.count ?? 0;
}
