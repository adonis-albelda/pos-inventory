import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";
import { assertCredentials } from "./env";
import type { DoubleAClient } from "./client-browser";

/** Minimal shape of the storage the mobile app hands in (AsyncStorage). */
export interface AsyncKeyValueStore {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
}

let cached: DoubleAClient | null = null;

/**
 * Client for apps/mobile.
 *
 * Deliberately different from the admin clients:
 *   - session persists in AsyncStorage, so an enrolled terminal never has to
 *     log in again;
 *   - `autoRefreshToken` is off and `detectSessionInUrl` is irrelevant — the
 *     app must make zero background network calls. The token is refreshed
 *     explicitly at the start of a manual sync;
 *   - realtime is unused. There are no subscriptions on mobile at all.
 */
export function createMobileClient(storage: AsyncKeyValueStore): DoubleAClient {
  if (cached) return cached;

  const { url, anonKey } = assertCredentials(
    process.env.EXPO_PUBLIC_SUPABASE_URL,
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    "EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY",
  );

  cached = createClient<Database>(url, anonKey, {
    auth: {
      storage,
      persistSession: true,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      headers: { "x-client-info": "double-a-pos-mobile" },
    },
  });

  return cached;
}

/** Test seam. */
export function resetMobileClient(): void {
  cached = null;
}
