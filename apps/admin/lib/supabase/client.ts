"use client";

import { createAdminBrowserClient } from "@double-a/supabase/browser";
import type { DoubleAClient } from "@double-a/supabase";

let client: DoubleAClient | null = null;

export function getBrowserClient(): DoubleAClient {
  client ??= createAdminBrowserClient();
  return client;
}
