import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";
import type { DoubleAClient } from "./client-browser";

/**
 * Service-role client for admin server actions that must touch Auth
 * (create/update terminal passwords) or columns revoked from `authenticated`.
 * Never import this into a browser or mobile bundle.
 */
export function createServiceRoleClient(): DoubleAClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is missing. Add it to apps/admin/.env.local (Project Settings → API → service_role). Needed to set terminal Auth passwords from the dashboard.",
    );
  }

  return createClient<Database>(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
