import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";
import { assertCredentials } from "./env";

export type DoubleAClient = SupabaseClient<Database>;

/**
 * Browser client for apps/admin. Session lives in cookies so server components
 * and middleware see the same session. Always online — no offline handling here.
 */
export function createAdminBrowserClient(): DoubleAClient {
  const { url, anonKey } = assertCredentials(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    "NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY",
  );

  return createBrowserClient<Database>(url, anonKey);
}
