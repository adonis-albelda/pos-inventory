/**
 * Bootstrap a platform superadmin: Auth user + public.users row.
 * Idempotent. Password comes from env — never logged.
 *
 *   pnpm create-superadmin
 *
 * Needs repo-root .env:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   SUPERADMIN_EMAIL
 *   SUPERADMIN_PASSWORD
 */

import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@double-a/supabase/types";

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing ${name} in .env`);
  }
  return value;
}

function isAlreadyRegistered(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes("already been registered") ||
    lower.includes("already registered") ||
    lower.includes("user already exists")
  );
}

async function findAuthUserIdByEmail(
  service: ReturnType<typeof createClient<Database>>,
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

async function main(): Promise<void> {
  const url = required("NEXT_PUBLIC_SUPABASE_URL");
  const serviceKey = required("SUPABASE_SERVICE_ROLE_KEY");
  const email = required("SUPERADMIN_EMAIL").toLowerCase();
  const password = required("SUPERADMIN_PASSWORD");
  const name = process.env.SUPERADMIN_NAME?.trim() || "Platform";

  if (password.length < 6) {
    throw new Error("SUPERADMIN_PASSWORD must be at least 6 characters.");
  }

  const service = createClient<Database>(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let authUserId: string | null = null;
  const created = await service.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (created.error) {
    if (!isAlreadyRegistered(created.error.message)) {
      throw new Error(created.error.message);
    }
    authUserId = await findAuthUserIdByEmail(service, email);
    if (!authUserId) {
      throw new Error("Email already registered in Auth, but the user could not be found.");
    }
    const { error: updateError } = await service.auth.admin.updateUserById(authUserId, {
      password,
      email_confirm: true,
    });
    if (updateError) throw new Error(updateError.message);
    console.log(`Auth user already existed. Password updated for ${email}.`);
  } else {
    if (!created.data.user) {
      throw new Error("Auth did not return a user.");
    }
    authUserId = created.data.user.id;
    console.log(`Auth user created for ${email}.`);
  }

  const { data: byAuth, error: byAuthError } = await service
    .from("users")
    .select("id, role, email")
    .eq("auth_user_id", authUserId)
    .maybeSingle();
  if (byAuthError) throw new Error(byAuthError.message);

  const { data: byEmail, error: byEmailError } = await service
    .from("users")
    .select("id, role, email")
    .ilike("email", email)
    .maybeSingle();
  if (byEmailError) throw new Error(byEmailError.message);

  const existing = byAuth ?? byEmail;
  if (existing && existing.role !== "superadmin") {
    throw new Error(
      `${existing.email} is already a ${existing.role}. Pick a different SUPERADMIN_EMAIL.`,
    );
  }

  if (existing) {
    const { error } = await service
      .from("users")
      .update({
        name,
        email,
        role: "superadmin",
        auth_user_id: authUserId,
        is_active: true,
        company_id: null,
      })
      .eq("id", existing.id);
    if (error) throw new Error(error.message);
    console.log(`Linked public.users ${existing.id} as superadmin.`);
  } else {
    const id = randomUUID();
    const { error } = await service.from("users").insert({
      id,
      name,
      email,
      role: "superadmin",
      auth_user_id: authUserId,
      is_active: true,
      company_id: null,
      can_sell: true,
      must_change_password: false,
    });
    if (error) throw new Error(error.message);
    console.log(`Inserted public.users ${id} as superadmin.`);
  }

  console.log("Done. Sign in at /login, then /platform.");
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
});
