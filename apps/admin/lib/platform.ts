import { redirect } from "next/navigation";
import { currentAppUser } from "@double-a/supabase";
import { getServerClient } from "@/lib/supabase/server";
import type { User } from "@double-a/shared-types";
import type { DoubleAClient } from "@double-a/supabase";

export function actingCompanyIdFromAuth(
  appMetadata: Record<string, unknown> | undefined,
): string | null {
  const value = appMetadata?.acting_company_id;
  return typeof value === "string" && value.length > 0 ? value : null;
}

export async function requireSuperadmin(): Promise<{
  supabase: DoubleAClient;
  user: User;
}> {
  const supabase = await getServerClient();
  const user = await currentAppUser(supabase);
  if (!user || user.role !== "superadmin") {
    redirect("/");
  }
  return { supabase, user };
}
