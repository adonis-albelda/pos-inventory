import { createServerClient } from "@supabase/ssr";
import type { Database } from "./database.types";
import { assertCredentials } from "./env";
import type { DoubleAClient } from "./client-browser";

export interface CookieRecord {
  name: string;
  value: string;
  options?: Record<string, unknown>;
}

/**
 * Cookie plumbing is passed in rather than imported, so this package never
 * depends on `next/headers` and stays usable from any server runtime.
 */
export interface CookieAdapter {
  getAll: () => CookieRecord[];
  setAll: (cookies: CookieRecord[]) => void;
}

export function createAdminServerClient(cookies: CookieAdapter): DoubleAClient {
  const { url, anonKey } = assertCredentials(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    "NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY",
  );

  return createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll: () => cookies.getAll(),
      setAll: (records) => cookies.setAll(records),
    },
  });
}
