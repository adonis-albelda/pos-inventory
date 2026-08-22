import { useCallback, useEffect, useState } from "react";
import { useFocusEffect } from "expo-router";
import { getFeatureFlags } from "@double-a/api-client/queries";
import { getLocalFeatureFlags } from "@/db/feature-flags";
import { getApiClient } from "@/lib/api/session";
import { useSync } from "@/sync/sync-provider";

/**
 * What a superadmin has turned on/off for this shop, as last pulled. Same
 * `dataVersion` keying as useStoreSettings — a pull can land while this
 * screen never loses focus. For the POS itself (voice search) — the offline
 * screen, so it has to read whatever the last pull left in SQLite.
 */
export function useFeatureFlags(): {
  flags: Record<string, boolean>;
  isEnabled: (key: string) => boolean;
} {
  const { dataVersion } = useSync();
  const [flags, setFlags] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let alive = true;

    void getLocalFeatureFlags().then((next) => {
      if (alive) setFlags(next);
    });

    return () => {
      alive = false;
    };
  }, [dataVersion]);

  return {
    flags,
    // A key this device has never pulled reads as enabled — see
    // db/feature-flags.ts.
    isEnabled: (key: string) => flags[key] ?? true,
  };
}

/**
 * The admin dashboard is online-only chrome, not the offline POS — so it
 * asks the Tally API directly every time the tab is opened instead of
 * waiting on SQLite/a pull. Nothing persisted; a key not seen yet (still
 * loading, or the request failed) reads as enabled, same fail-open rule as
 * the SQLite version.
 */
export function useLiveFeatureFlags(): {
  flags: Record<string, boolean>;
  loading: boolean;
  isEnabled: (key: string) => boolean;
} {
  const [flags, setFlags] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      setLoading(true);

      void getFeatureFlags(getApiClient())
        .then((next) => {
          if (alive) setFlags(next);
        })
        .catch(() => {
          // Fail open — leave whatever was last fetched (or nothing, which
          // still resolves every key enabled).
        })
        .finally(() => {
          if (alive) setLoading(false);
        });

      return () => {
        alive = false;
      };
    }, []),
  );

  return {
    flags,
    loading,
    isEnabled: (key: string) => flags[key] ?? true,
  };
}
