import { verifyCashierPin } from "@double-a/supabase";
import { ensureFreshSession, getSupabase } from "@/lib/supabase";

/**
 * Live PIN check against Supabase. Local SQLite never sees the PIN or the hash
 * at unlock time — that is what verify_pin() is for.
 */
export async function verifyPin(userId: string, pin: string): Promise<boolean> {
  await ensureFreshSession();
  return verifyCashierPin(getSupabase(), userId, pin);
}
