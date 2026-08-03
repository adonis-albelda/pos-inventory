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
  // current_app_role() is security definer (same as mobile enrollment).
  const { data: role, error: roleError } = await supabase.rpc("current_app_role");
  if (roleError || role !== "admin") {
    await supabase.auth.signOut();
    return {
      error: "This account is not an active admin. Ask an owner to grant access.",
    };
  }

  // Only ever an in-app path, so an open redirect is not possible here.
  redirect(next.startsWith("/") ? (next as Route) : "/");
}

export async function signOut(): Promise<void> {
  const supabase = await getServerClient();
  await supabase.auth.signOut();
  redirect("/login");
}
