"use server";

import { redirect } from "next/navigation";
import { getServerClient } from "@/lib/supabase/server";

export interface ChangePasswordState {
  error: string | null;
}

export async function changeOwnPassword(
  _prev: ChangePasswordState,
  formData: FormData,
): Promise<ChangePasswordState> {
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (password.length < 6) {
    return { error: "Password must be at least 6 characters." };
  }
  if (password !== confirm) {
    return { error: "Those passwords do not match." };
  }

  const supabase = await getServerClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    return { error: error.message };
  }

  const { error: clearError } = await supabase.rpc("clear_must_change_password");
  if (clearError) {
    return { error: clearError.message };
  }

  redirect("/");
}
