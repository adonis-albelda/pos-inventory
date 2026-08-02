import * as SQLite from "expo-sqlite";
import { MIGRATIONS, SCHEMA_VERSION } from "./schema";

const DATABASE_NAME = "double-a-pos.db";

let database: SQLite.SQLiteDatabase | null = null;

export function getDb(): SQLite.SQLiteDatabase {
  database ??= SQLite.openDatabaseSync(DATABASE_NAME);
  return database;
}

/**
 * Brings the local database up to `SCHEMA_VERSION`, one step at a time.
 *
 * `PRAGMA user_version` records how far this device has got. Every step above
 * that number runs in order, each inside its own transaction, and the version is
 * bumped in the same transaction as the step it belongs to. A step that fails
 * halfway — no disk space, an interrupted update — rolls back whole and leaves
 * the version where it was, so the next launch retries that one step rather than
 * landing on a half-migrated database.
 *
 * The steps are additive by rule, never a drop-and-recreate. That is what lets a
 * terminal holding a day of unsynced sales take an app update and still have
 * every one of them afterwards: the rows are never rewritten, they just gain
 * columns with defaults.
 */
export async function migrate(): Promise<void> {
  const db = getDb();

  // Both are connection-level and neither belongs inside a transaction.
  await db.execAsync("PRAGMA journal_mode = WAL;");
  await db.execAsync("PRAGMA foreign_keys = ON;");

  const row = await db.getFirstAsync<{ user_version: number }>("PRAGMA user_version");
  const current = row?.user_version ?? 0;

  if (current >= SCHEMA_VERSION) return;

  for (const step of MIGRATIONS) {
    if (step.version <= current) continue;

    await db.withTransactionAsync(async () => {
      await db.execAsync(step.sql);
      await db.execAsync(`PRAGMA user_version = ${step.version};`);
    });
  }
}

/**
 * Wipes the working copy. Safe for products and users because Supabase is the
 * source of truth — but it would destroy sales that have not been pushed, so it
 * refuses while any are pending.
 */
export async function resetLocalData(): Promise<void> {
  const db = getDb();
  const pending = await db.getFirstAsync<{ count: number }>(
    "SELECT COUNT(*) AS count FROM sales WHERE sync_status = 'pending'",
  );

  if ((pending?.count ?? 0) > 0) {
    throw new Error(
      "There are sales that have not been synced yet. Sync first, then reset.",
    );
  }

  await db.withTransactionAsync(async () => {
    // The high water mark has to go with the rows it describes. Leaving it set
    // would make the next pull ask only for what changed since the wipe, and
    // the catalogue would never come back.
    await db.execAsync(`
      DELETE FROM sale_items;
      DELETE FROM sales;
      DELETE FROM products;
      DELETE FROM users;
      DELETE FROM categories;
      UPDATE sync_meta
         SET last_synced_at = NULL,
             high_water_mark = NULL,
             first_pull_done = 0
       WHERE id = 1;
    `);
  });
}
