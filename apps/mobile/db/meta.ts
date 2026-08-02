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
