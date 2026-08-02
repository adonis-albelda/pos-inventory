import { cookies } from "next/headers";
import { createAdminServerClient } from "@double-a/supabase/server";
import type { DoubleAClient } from "@double-a/supabase";

/**
 * Server-side client for server components and server actions. Always online —
 * apps/admin has no offline mode, so there is no caching or retry layer here.
 */
export async function getServerClient(): Promise<DoubleAClient> {
  const cookieStore = await cookies();

  return createAdminServerClient({
    getAll: () => cookieStore.getAll(),
    setAll: (records) => {
      try {
        for (const { name, value, options } of records) {
          cookieStore.set(name, value, options);
        }
      } catch {
        // Server components cannot set cookies. Middleware refreshes the
        // session instead, so ignoring this is safe.
      }
    },
  });
}
