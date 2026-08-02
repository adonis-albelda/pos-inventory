import type { PullResult, SyncPhase, SyncResult } from "@double-a/shared-types";
import { ensureFreshSession } from "@/lib/supabase";
import { pull } from "./pull";
import { push } from "./push";

export { pull } from "./pull";
export { push } from "./push";

/**
 * The one sync action, exactly two steps, always in this order:
 *
 *   1. push local sales
 *   2. pull master data — only if the push succeeded
 *
 * Nothing here runs on a timer, on reconnect, or in the background. It only ever
 * happens because someone pressed the button.
 */
export async function runSync(
  onPhase?: (phase: SyncPhase) => void,
): Promise<SyncResult> {
  onPhase?.("pushing");
  await ensureFreshSession();

  const pushResult = await push();

  onPhase?.("pulling");
  const pullResult = await pull();

  onPhase?.("done");

  return {
    push: pushResult,
    pull: pullResult,
    finishedAt: new Date().toISOString(),
  };
}

/**
 * Pull without pushing first, for taking a price or product change mid-shift
 * without sending sales. Pending sales stay pending and still go out on the
 * next full sync, so this never loses a sale — it only skips sending one.
 */
export async function runPullOnly(
  onPhase?: (phase: SyncPhase) => void,
): Promise<PullResult> {
  onPhase?.("pulling");
  await ensureFreshSession();

  const result = await pull();

  onPhase?.("done");
  return result;
}

/** First launch: everything comes down before the POS is usable. */
export async function runFirstPull(): Promise<void> {
  await ensureFreshSession();
  await pull({ full: true });
}
