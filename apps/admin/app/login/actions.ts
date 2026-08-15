"use server";

import type { Route } from "next";
import { redirect } from "next/navigation";
import { getServerClient } from "@/lib/supabase/server";

export interface LoginState {
  error: string | null;
}

export async function signIn(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "/");

  if (!email || !password) {
    return { error: "Enter your email and password." };
  }

  const supabase = await getServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: "That email and password do not match an account." };
  }

  // auth_user_id is revoked from authenticated clients — never filter on it.
  const { data: appRows, error: appError } = await supabase.rpc("current_app_user");
  const appUser = Array.isArray(appRows) ? appRows[0] : appRows;
  if (appError || !appUser) {
    await supabase.auth.signOut();
    return {
      error: "This account is not an active admin. Ask an owner to grant access.",
    };
  }

  if (appUser.role !== "admin" && appUser.role !== "superadmin") {
    await supabase.auth.signOut();
    return {
      error: "This account is not an active admin. Ask an owner to grant access.",
    };
  }

  if (appUser.role === "admin" && appUser.company_is_active === false) {
    await supabase.auth.signOut();
    return {
      error: "This shop account is disabled. Contact the platform operator.",
    };
  }

  if (appUser.must_change_password) {
    redirect("/change-password");
  }

  if (appUser.role === "superadmin") {
    const dest = next.startsWith("/platform") ? next : "/platform";
    redirect(dest as Route);
  }

  redirect(next.startsWith("/") ? (next as Route) : "/");
}

export async function signOut(): Promise<void> {
  const supabase = await getServerClient();
  await supabase.auth.signOut();
  redirect("/login");
}
