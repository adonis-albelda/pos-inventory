import { currentAppRole, verifyCashierPin } from "@double-a/supabase";
import { ensureFreshSession, getSupabase } from "@/lib/supabase";

export type PinResult =
  | "ok"
  /** Wrong digits, or that person has no PIN set at all — indistinguishable. */
  | "wrong-pin"
  /** This terminal's own sign-in is not one the server accepts. */
  | "terminal-not-authorized";

/**
 * Live PIN check against Supabase. Local SQLite never sees the PIN or the hash
 * at unlock time — that is what verify_pin() is for.
 *
 * verify_pin() answers with a bare false for every failure: wrong digits, no
 * PIN set, or a caller whose role is not device/admin. Reads are unaffected in
 * that last case, so the cashier list still fills and only unlock breaks —
 * which reads to a cashier as "my PIN stopped working". The role is probed on
 * failure to tell the three apart.
 */
export async function verifyPin(userId: string, pin: string): Promise<PinResult> {
  await ensureFreshSession();
  const supabase = getSupabase();

  if (await verifyCashierPin(supabase, userId, pin)) return "ok";

  const role = await currentAppRole(supabase);
  if (role !== "device" && role !== "admin") return "terminal-not-authorized";

  return "wrong-pin";
}
