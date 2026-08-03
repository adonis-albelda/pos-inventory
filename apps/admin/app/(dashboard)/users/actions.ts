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

/** Roles that sign in through Supabase Auth (email/password), not pin_hash. */
function needsAuthPassword(role: string): boolean {
  return role === "admin" || role === "device";
}

/** Roles verify_pin() accepts for a terminal unlock. Admins optionally. */
function canUnlockWithPin(role: string): boolean {
  return role === "cashier" || role === "admin";
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof (error as { message: unknown }).message === "string"
  ) {
    return (error as { message: string }).message;
  }
  return "Unknown error";
}

function isAlreadyRegistered(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes("already been registered") ||
    lower.includes("already registered") ||
    lower.includes("user already exists")
  );
}

/**
 * Find an Auth user by email. Admin list is paginated; shops stay small.
 */
async function findAuthUserIdByEmail(
  service: ReturnType<typeof createServiceRoleClient>,
  email: string,
): Promise<string | null> {
  const needle = email.toLowerCase();
  for (let page = 1; page <= 10; page += 1) {
    const { data, error } = await service.auth.admin.listUsers({
      page,
      perPage: 200,
    });
    if (error) throw new Error(error.message);
    const match = data.users.find((user) => user.email?.toLowerCase() === needle);
    if (match) return match.id;
    if (data.users.length < 200) break;
  }
  return null;
}

/**
 * Create or update the Auth login, then point public.users.auth_user_id at it.
 * Resolves "email already registered" by linking the existing Auth row instead
 * of failing — that mismatch is what left admins able to use PIN but not the
 * dashboard.
 */
async function syncAuthPassword(opts: {
  userId: string;
  email: string;
  password: string;
  authUserId: string | null;
}): Promise<void> {
  const service = createServiceRoleClient();
  let authUserId = opts.authUserId;

  if (authUserId) {
    const { error } = await service.auth.admin.updateUserById(authUserId, {
      password: opts.password,
      email: opts.email,
      email_confirm: true,
    });
    if (error) {
      // Stale auth_user_id (deleted Auth user, or pointed at someone else's).
      // Fall through to create / find-by-email.
      authUserId = null;
    } else {
      return;
    }
  }

  const created = await service.auth.admin.createUser({
    email: opts.email,
    password: opts.password,
    email_confirm: true,
  });

  if (created.error) {
    if (!isAlreadyRegistered(created.error.message)) {
      throw new Error(created.error.message);
    }
    const existingId = await findAuthUserIdByEmail(service, opts.email);
    if (!existingId) {
      throw new Error(
        "That email already has an Auth login, but it could not be found to link.",
      );
    }
    const { error: updateError } = await service.auth.admin.updateUserById(
      existingId,
      {
        password: opts.password,
        email_confirm: true,
      },
    );
    if (updateError) throw new Error(updateError.message);
    authUserId = existingId;
  } else {
    if (!created.data.user) {
      throw new Error("Auth did not return a user for this login.");
    }
    authUserId = created.data.user.id;
  }

  // Unique auth_user_id — clear any other row wrongly holding this Auth id.
  await service
    .from("users")
    .update({ auth_user_id: null })
    .eq("auth_user_id", authUserId)
    .neq("id", opts.userId);

  const { error: linkError } = await service
    .from("users")
    .update({ auth_user_id: authUserId })
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
  const mustChangePassword = formData.get("must_change_password") === "true";
  const canSell = formData.get("can_sell") === "true";

  if (!name) return { error: "Name is required.", ok: false };
  if (!email) return { error: "Email is required — it identifies the person.", ok: false };

  if (canUnlockWithPin(role)) {
    if (pin && !isValidPin(pin)) {
      return { error: "The PIN must be 4 to 6 digits.", ok: false };
    }
    // Admins can unlock without one; a cashier with no PIN cannot work at all.
    if (role === "cashier" && !id && !pin) {
      return { error: "Set a PIN so this cashier can unlock a terminal.", ok: false };
    }
  }

  if (needsAuthPassword(role)) {
    if (!id && !password) {
      return {
        error:
          role === "admin"
            ? "Set a password so this admin can sign in to the dashboard."
            : "Set a password — the POS uses it when connecting this terminal.",
        ok: false,
      };
    }
    if (password && password.length < 6) {
      return {
        error:
          role === "admin"
            ? "Admin password must be at least 6 characters."
            : "Terminal password must be at least 6 characters.",
        ok: false,
      };
    }
  }

  const supabase = await getServerClient();

  try {
    if (id) {
      let authUserId: string | null = null;

      if (needsAuthPassword(role)) {
        const service = createServiceRoleClient();
        const { data: row, error } = await service
          .from("users")
          .select("auth_user_id")
          .eq("id", id)
          .single();
        if (error) throw new Error(error.message);
        authUserId = row.auth_user_id;

        if (!authUserId && !password) {
          return {
            error:
              role === "admin"
                ? "Set a password — this person has no dashboard login yet."
                : "Set a password — this terminal has no Auth login yet.",
            ok: false,
          };
        }
      }

      await updateUser(supabase, id, {
        name,
        email,
        role,
        can_sell: role === "device" ? true : canSell,
        ...(needsAuthPassword(role)
          ? { must_change_password: mustChangePassword }
          : { must_change_password: false }),
        ...(canUnlockWithPin(role) && pin ? { pin_hash: hashPin(id, pin) } : {}),
      });

      if (needsAuthPassword(role) && password) {
        await syncAuthPassword({
          userId: id,
          email,
          password,
          authUserId,
        });
      }
    } else {
      const newId = randomUUID();

      if (needsAuthPassword(role)) {
        const service = createServiceRoleClient();
        await createUser(service, {
          id: newId,
          name,
          email,
          role,
          auth_user_id: null,
          pin_hash: canUnlockWithPin(role) && pin ? hashPin(newId, pin) : null,
          can_sell: role === "device" ? true : canSell,
          must_change_password: mustChangePassword,
        });
        await syncAuthPassword({
          userId: newId,
          email,
          password,
          authUserId: null,
        });
      } else {
        await createUser(supabase, {
          id: newId,
          name,
          email,
          role,
          pin_hash: canUnlockWithPin(role) && pin ? hashPin(newId, pin) : null,
          can_sell: canSell,
          must_change_password: false,
        });
      }
    }
  } catch (error) {
    const message = errorMessage(error);
    return {
      error: message.includes("SUPABASE_SERVICE_ROLE_KEY")
        ? "Server is missing SUPABASE_SERVICE_ROLE_KEY. Add it to apps/admin/.env.local (Supabase → Project Settings → API → service_role), then restart admin."
        : message.includes("users_email_key")
          ? "That email is already used by another person."
          : isAlreadyRegistered(message)
            ? "That email already has an Auth login. Save again with a password to link it, or pick a new email."
            : `Could not save: ${message}`,
      ok: false,
    };
  }

  revalidatePath("/users");
  return { error: null, ok: true };
}

/**
 * Admin resets another person's dashboard/terminal Auth password.
 * Optionally forces them to change it on next sign-in.
 */
export async function resetUserPassword(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const id = String(formData.get("id") ?? "");
  const password = String(formData.get("password") ?? "");
  const mustChangePassword = formData.get("must_change_password") === "true";

  if (!id) return { error: "Missing user.", ok: false };
  if (password.length < 6) {
    return { error: "Password must be at least 6 characters.", ok: false };
  }

  try {
    const service = createServiceRoleClient();
    const { data: row, error } = await service
      .from("users")
      .select("id, email, role, auth_user_id")
      .eq("id", id)
      .single();
    if (error) throw new Error(error.message);
    if (!needsAuthPassword(row.role)) {
      return {
        error: "Only admins and terminals have an Auth password. Cashiers use a PIN.",
        ok: false,
      };
    }

    await syncAuthPassword({
      userId: row.id,
      email: row.email,
      password,
      authUserId: row.auth_user_id,
    });

    await updateUser(service, id, { must_change_password: mustChangePassword });
  } catch (error) {
    const message = errorMessage(error);
    return {
      error: message.includes("SUPABASE_SERVICE_ROLE_KEY")
        ? "Server is missing SUPABASE_SERVICE_ROLE_KEY. Add it to apps/admin/.env.local, then restart admin."
        : `Could not reset password: ${message}`,
      ok: false,
    };
  }

  revalidatePath("/users");
  return { error: null, ok: true };
}

/** Floor staff: unlock still works; completing a sale does not. */
export async function toggleUserCanSell(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  const canSell = String(formData.get("can_sell") ?? "") === "true";

  const supabase = await getServerClient();
  await updateUser(supabase, id, { can_sell: canSell });

  revalidatePath("/users");
}

export async function toggleCashierActive(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  const isActive = String(formData.get("is_active") ?? "") === "true";

  const supabase = await getServerClient();
  await updateUser(supabase, id, { is_active: isActive });

  revalidatePath("/users");
}
