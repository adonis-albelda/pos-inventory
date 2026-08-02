import { useEffect, useState } from "react";
import { DEFAULT_STORE_SETTINGS, type StoreSettings } from "@double-a/shared-types";
import { getLocalStoreSettings } from "@/db/store";
import { useSync } from "@/sync/sync-provider";

/**
 * Who the shop is, as last pulled. Defaults stand in until the first pull, so a
 * terminal being set up still has a name to draw.
 *
 * Keyed on `dataVersion` rather than on focus: a pull is started from the header
 * that renders this, which means the screen never loses focus and a rename in
 * the office would otherwise sit in SQLite unread until the app restarted.
 */
export function useStoreSettings(): StoreSettings {
  const { dataVersion } = useSync();
  const [settings, setSettings] = useState<StoreSettings>(DEFAULT_STORE_SETTINGS);

  useEffect(() => {
    let alive = true;

    void getLocalStoreSettings().then((next) => {
      if (alive) setSettings(next);
    });

    return () => {
      alive = false;
    };
  }, [dataVersion]);

  return settings;
}
