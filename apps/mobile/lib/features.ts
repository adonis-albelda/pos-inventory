import { useEffect, useState } from "react";
import { getLocalFeatureFlags } from "@/db/feature-flags";
import { useSync } from "@/sync/sync-provider";

/**
 * What a superadmin has turned on/off for this shop, as last pulled. Same
 * `dataVersion` keying as useStoreSettings — a pull can land while this
 * screen never loses focus.
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
