import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { SYNC_MESSAGES, type SyncPhase, type SyncState } from "@double-a/shared-types";
import { getSyncMeta } from "@/db/meta";
import { countPendingSales } from "@/db/sales";
import { runPullOnly, runSync } from "./index";

interface SyncContextValue extends SyncState {
  /**
   * Bumped every time a pull has written master data to SQLite. Screens that
   * are already mounted watch this and re-read — without it, a price or name
   * changed in the office lands in the database but the cashier keeps looking
   * at the list that was loaded when the screen opened.
   */
  dataVersion: number;
  sync: () => Promise<void>;
  pullOnly: () => Promise<void>;
  refresh: () => Promise<void>;
}

const SyncContext = createContext<SyncContextValue | null>(null);

const INITIAL: SyncState = {
  phase: "idle",
  message: "",
  lastSyncedAt: null,
  pendingSales: 0,
  error: null,
};

export function SyncProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SyncState>(INITIAL);
  const [dataVersion, setDataVersion] = useState(0);

  const refresh = useCallback(async () => {
    const [meta, pendingSales] = await Promise.all([
      getSyncMeta(),
      countPendingSales(),
    ]);

    setState((previous) => ({
      ...previous,
      lastSyncedAt: meta.lastSyncedAt,
      pendingSales,
    }));
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const sync = useCallback(async () => {
    setState((previous) => ({
      ...previous,
      phase: "pushing",
      message: SYNC_MESSAGES.pushing,
      error: null,
    }));

    try {
      await runSync((phase: SyncPhase) => {
        setState((previous) => ({
          ...previous,
          phase,
          message: SYNC_MESSAGES[phase],
        }));
      });

      await refresh();
      setDataVersion((version) => version + 1);
      setState((previous) => ({
        ...previous,
        phase: "done",
        message: SYNC_MESSAGES.done,
        error: null,
      }));
    } catch (error) {
      // The push failed, so the pull never ran and local sales are untouched —
      // they stay pending and go again on the next attempt.
      await refresh();
      setState((previous) => ({
        ...previous,
        phase: "failed",
        message: SYNC_MESSAGES.failed,
        error:
          error instanceof Error
            ? error.message
            : "Sync failed - check your connection and try again",
      }));
    }
  }, [refresh]);

  /**
   * Fetches master data on its own, leaving pending sales where they are. The
   * Sync button stays the way sales leave the device.
   */
  const pullOnly = useCallback(async () => {
    setState((previous) => ({
      ...previous,
      phase: "pulling",
      message: SYNC_MESSAGES.pulling,
      error: null,
    }));

    try {
      await runPullOnly();

      await refresh();
      setDataVersion((version) => version + 1);
      setState((previous) => ({
        ...previous,
        phase: "done",
        message: SYNC_MESSAGES.done,
        error: null,
      }));
    } catch (error) {
      await refresh();
      setState((previous) => ({
        ...previous,
        phase: "failed",
        message: SYNC_MESSAGES.failed,
        error:
          error instanceof Error
            ? error.message
            : "Refresh failed - check your connection and try again",
      }));
    }
  }, [refresh]);

  const value = useMemo(
    () => ({ ...state, dataVersion, sync, pullOnly, refresh }),
    [state, dataVersion, sync, pullOnly, refresh],
  );

  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>;
}

export function useSync(): SyncContextValue {
  const context = useContext(SyncContext);
  if (!context) throw new Error("useSync must be used inside SyncProvider");
  return context;
}
