import "react-native-url-polyfill/auto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { currentAppUser } from "@double-a/supabase";
import { createMobileClient } from "@double-a/supabase/mobile";
import type { DoubleAClient } from "@double-a/supabase";
import { resetLocalData } from "@/db";
import { getEnrolledCompanyId, setEnrolledCompanyId } from "@/lib/device";

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
  if (expiresAt - Date.now() <= 60_000) {
    const { error } = await supabase.auth.refreshSession();
    if (error) {
      throw new Error(
        "This terminal needs to be set up again — its sign-in has expired.",
      );
    }
  }

  await bindEnrolledCompany();
}

async function bindEnrolledCompany(): Promise<void> {
  const me = await currentAppUser(getSupabase());
  if (!me || (me.role !== "admin" && me.role !== "device")) {
    throw new Error(
      "This terminal is not set up yet. Finish setup before syncing.",
    );
  }
  if (!me.companyIsActive) {
    throw new Error("This shop account is disabled. Contact the office.");
  }
  if (!me.companyId) {
    throw new Error("This login is not linked to a company.");
  }

  const stored = await getEnrolledCompanyId();
  if (stored && stored !== me.companyId) {
    await resetLocalData();
  }
  await setEnrolledCompanyId(me.companyId);
}

export async function isEnrolled(): Promise<boolean> {
  const { data } = await getSupabase().auth.getSession();
  return Boolean(data.session);
}
