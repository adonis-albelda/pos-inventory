"use server";

import { createHash, randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { isValidPin, pinHashInput } from "@double-a/shared-types";
import { createUser, updateUser } from "@double-a/supabase";
import { createServiceRoleClient } from "@double-a/supabase/service";
import type { FormState } from "@/lib/form-state";
import { getServerClient } from "@/lib/supabase/server";

function hashPin(userId: string, pin: string): string {
  return createHash("sha256").update(pinHashInput(userId, pin)).digest("hex");
}

/**
 * Terminal enrollment signs in with Supabase Auth email/password — not pin_hash.
 * Cashiers unlock with PIN. Keep those paths separate.
 */
async function syncTerminalAuthPassword(opts: {
  userId: string;
  email: string;
  password: string;
  authUserId: string | null;
}): Promise<void> {
  const service = createServiceRoleClient();

  if (opts.authUserId) {
    const { error } = await service.auth.admin.updateUserById(opts.authUserId, {
      password: opts.password,
      email: opts.email,
    });
    if (error) throw new Error(error.message);
    return;
  }

  const { data, error } = await service.auth.admin.createUser({
    email: opts.email,
    password: opts.password,
    email_confirm: true,
  });
  if (error) throw new Error(error.message);
  if (!data.user) throw new Error("Auth did not return a user for this terminal.");

  const { error: linkError } = await service
    .from("users")
    .update({ auth_user_id: data.user.id })
    .eq("id", opts.userId);
  if (linkError) throw new Error(linkError.message);
}

export async function saveCashier(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const role = String(formData.get("role") ?? "cashier");
  const pin = String(formData.get("pin") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!name) return { error: "Name is required.", ok: false };
  if (!email) return { error: "Email is required — it identifies the person.", ok: false };

  if (role === "cashier") {
    if (pin && !isValidPin(pin)) {
      return { error: "The PIN must be 4 to 6 digits.", ok: false };
    }
    if (!id && !pin) {
      return { error: "Set a PIN so this cashier can unlock a terminal.", ok: false };
    }
  }

  if (role === "device") {
    if (!id && !password) {
      return {
        error: "Set a password — the POS uses it when connecting this terminal.",
        ok: false,
      };
    }
    if (password && password.length < 6) {
      return { error: "Terminal password must be at least 6 characters.", ok: false };
    }
  }

  const supabase = await getServerClient();

  try {
    if (id) {
      await updateUser(supabase, id, {
        name,
        email,
        role,
        ...(role === "cashier" && pin ? { pin_hash: hashPin(id, pin) } : {}),
      });

      if (role === "device" && password) {
        const service = createServiceRoleClient();
        const { data: row, error } = await service
          .from("users")
          .select("auth_user_id")
          .eq("id", id)
          .single();
        if (error) throw new Error(error.message);

        await syncTerminalAuthPassword({
          userId: id,
          email,
          password,
          authUserId: row.auth_user_id,
        });
      }
    } else {
      const newId = randomUUID();

      if (role === "device") {
        // Auth user first so public.users can link auth_user_id in one insert.
        const service = createServiceRoleClient();
        const { data, error } = await service.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
        });
        if (error) throw new Error(error.message);
        if (!data.user) throw new Error("Auth did not return a user for this terminal.");

        await createUser(supabase, {
          id: newId,
          name,
          email,
          role,
          auth_user_id: data.user.id,
          pin_hash: null,
        });
      } else {
        await createUser(supabase, {
          id: newId,
          name,
          email,
          role,
          pin_hash: role === "cashier" && pin ? hashPin(newId, pin) : null,
        });
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return {
      error: message.includes("users_email_key")
        ? "That email is already used by another person."
        : message.includes("already been registered")
          ? "That email already has an Auth login. Link it in the seed, or pick a new email."
          : `Could not save: ${message}`,
      ok: false,
    };
  }

  revalidatePath("/users");
  return { error: null, ok: true };
}

export async function toggleCashierActive(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  const isActive = String(formData.get("is_active") ?? "") === "true";

  const supabase = await getServerClient();
  await updateUser(supabase, id, { is_active: isActive });

  revalidatePath("/users");
}
