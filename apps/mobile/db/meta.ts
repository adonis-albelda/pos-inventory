import { getDb } from "./index";

export interface SyncMeta {
  /** When this device last finished a sync. Drives the "X ago" indicator. */
  lastSyncedAt: string | null;
  /** Newest server-side updated_at seen so far. Filters the next pull. */
  highWaterMark: string | null;
  firstPullDone: boolean;
}

export async function getSyncMeta(): Promise<SyncMeta> {
  const row = await getDb().getFirstAsync<{
    last_synced_at: string | null;
    high_water_mark: string | null;
    first_pull_done: number;
  }>(
    "SELECT last_synced_at, high_water_mark, first_pull_done FROM sync_meta WHERE id = 1",
  );

  return {
    lastSyncedAt: row?.last_synced_at ?? null,
    highWaterMark: row?.high_water_mark ?? null,
    firstPullDone: (row?.first_pull_done ?? 0) === 1,
  };
}

/**
 * `highWaterMark` must be a timestamp the server produced. `syncedAt` is local
 * wall time and is only ever shown to the cashier, never used to filter a query.
 */
/**
 * Marks setup complete without a real pull — for an admin login that skips
 * the mandatory download-catalog step at setup (CLAUDE.md: admin-mode is
 * the one place a mobile session doesn't need the offline product catalog
 * up front; a Terminal account still gets the forced first pull). Leaves
 * `last_synced_at`/`high_water_mark` untouched (both still null) so the
 * sync chip never claims a sync that did not happen, and the next real
 * pull — whenever it happens from the Sync tab — has no watermark to
 * filter against and correctly comes down as a full pull.
 */
export async function markFirstPullSkipped(): Promise<void> {
  await getDb().runAsync("UPDATE sync_meta SET first_pull_done = 1 WHERE id = 1");
}

export async function recordSyncSuccess(
  syncedAt: string,
  highWaterMark: string | null,
): Promise<void> {
  await getDb().runAsync(
    `UPDATE sync_meta
        SET last_synced_at = ?,
            high_water_mark = COALESCE(?, high_water_mark),
            first_pull_done = 1
      WHERE id = 1`,
    syncedAt,
    highWaterMark,
  );
}
