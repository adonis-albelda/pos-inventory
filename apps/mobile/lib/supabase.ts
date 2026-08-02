import "react-native-url-polyfill/auto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createMobileClient } from "@double-a/supabase/mobile";
import type { DoubleAClient } from "@double-a/supabase";

/**
 * The one Supabase client on this device. It is only ever touched during a
 * manual sync: no realtime subscriptions, no background refresh, nothing that
 * fires on reconnect.
 */
export function getSupabase(): DoubleAClient {
  return createMobileClient(AsyncStorage);
}

/**
 * Called at the start of a sync. With autoRefreshToken off the access token goes
 * stale while the app sits offline, so it is refreshed here — deliberately, at a
 * moment the user asked for network activity.
 */
export async function ensureFreshSession(): Promise<void> {
  const supabase = getSupabase();
  const { data } = await supabase.auth.getSession();

  if (!data.session) {
    throw new Error(
      "This terminal is not set up yet. Finish setup before syncing.",
    );
  }

  const expiresAt = (data.session.expires_at ?? 0) * 1000;
  if (expiresAt - Date.now() > 60_000) return;

  const { error } = await supabase.auth.refreshSession();
  if (error) {
    throw new Error(
      "This terminal needs to be set up again — its sign-in has expired.",
    );
  }
}

export async function isEnrolled(): Promise<boolean> {
  const { data } = await getSupabase().auth.getSession();
  return Boolean(data.session);
}
