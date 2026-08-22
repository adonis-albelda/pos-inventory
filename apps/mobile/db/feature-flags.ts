import { getDb } from "./index";

/**
 * What a superadmin has turned on/off for this shop. Whole-replace every
 * pull, same reasoning as categories (CLAUDE.md §1) — a flag flip has to
 * reach the device without needing its own updated_at cursor, and a
 * `DELETE` here can't accidentally orphan anything the way it would for
 * products/sales.
 */
export async function replaceFeatureFlags(flags: Record<string, boolean>): Promise<void> {
  const db = getDb();
  await db.withTransactionAsync(async () => {
    await db.execAsync("DELETE FROM feature_flags;");
    for (const [key, enabled] of Object.entries(flags)) {
      await db.runAsync(
        "INSERT INTO feature_flags (key, enabled) VALUES (?, ?)",
        key,
        enabled ? 1 : 0,
      );
    }
  });
}

/**
 * A key this device has never pulled (new install, or a feature added to
 * the catalog after this device's last sync) reads as enabled — the app
 * must not silently hide something a terminal was never told about.
 */
export async function getLocalFeatureFlags(): Promise<Record<string, boolean>> {
  const rows = await getDb().getAllAsync<{ key: string; enabled: number }>(
    "SELECT key, enabled FROM feature_flags",
  );
  return Object.fromEntries(rows.map((row) => [row.key, row.enabled === 1]));
}
