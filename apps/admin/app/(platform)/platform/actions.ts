"use server";

import { randomUUID } from "node:crypto";
import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Route } from "next";
import { isValidPin, pinHashInput } from "@double-a/shared-types";
import { createUser, updateUser } from "@double-a/supabase";
import { createServiceRoleClient } from "@double-a/supabase/service";
import type { FormState } from "@/lib/form-state";
import { getServerClient } from "@/lib/supabase/server";
import { requireSuperadmin } from "@/lib/platform";

function hashPin(userId: string, pin: string): string {
  return createHash("sha256").update(pinHashInput(userId, pin)).digest("hex");
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
      { password: opts.password, email_confirm: true },
    );
    if (updateError) throw new Error(updateError.message);
    authUserId = existingId;
  } else {
    if (!created.data.user) {
      throw new Error("Auth did not return a user for this login.");
    }
    authUserId = created.data.user.id;
  }

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

export async function createCompany(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireSuperadmin();

  const name = String(formData.get("name") ?? "").trim();
  const adminName = String(formData.get("admin_name") ?? "").trim();
  const adminEmail = String(formData.get("admin_email") ?? "").trim();
  const adminPassword = String(formData.get("admin_password") ?? "");
  const adminPin = String(formData.get("admin_pin") ?? "").trim();

  if (!name) return { error: "Company name is required.", ok: false };
  if (!adminName) return { error: "Admin name is required.", ok: false };
  if (!adminEmail) return { error: "Admin email is required.", ok: false };
  if (adminPassword.length < 6) {
    return { error: "Admin password must be at least 6 characters.", ok: false };
  }
  if (!isValidPin(adminPin)) {
    return {
      error: "Admin PIN must be 4 to 6 digits. The POS unlocks with this PIN, not the dashboard password.",
      ok: false,
    };
  }

  const service = createServiceRoleClient();

  try {
    const { data: company, error: companyError } = await service
      .from("companies")
      .insert({ name, is_active: true })
      .select("id")
      .single();
    if (companyError) throw new Error(companyError.message);

    const companyId = company.id;

    const { error: settingsError } = await service.from("store_settings").insert({
      company_id: companyId,
      name,
    });
    if (settingsError) throw new Error(settingsError.message);

    const { error: layoutError } = await service.from("receipt_layout").insert({
      company_id: companyId,
    });
    if (layoutError) throw new Error(layoutError.message);

    const adminId = randomUUID();
    await createUser(service, {
      id: adminId,
      name: adminName,
      email: adminEmail,
      role: "admin",
      company_id: companyId,
      auth_user_id: null,
      pin_hash: hashPin(adminId, adminPin),
      can_sell: true,
      must_change_password: true,
    });
    await syncAuthPassword({
      userId: adminId,
      email: adminEmail,
      password: adminPassword,
      authUserId: null,
    });
  } catch (error) {
    return { error: errorMessage(error), ok: false };
  }

  revalidatePath("/platform");
  redirect("/platform" as Route);
}

export async function addCompanyAdmin(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireSuperadmin();

  const companyId = String(formData.get("company_id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const pin = String(formData.get("pin") ?? "").trim();

  if (!companyId) return { error: "Missing company.", ok: false };
  if (!name) return { error: "Name is required.", ok: false };
  if (!email) return { error: "Email is required.", ok: false };
  if (password.length < 6) {
    return { error: "Password must be at least 6 characters.", ok: false };
  }
  if (pin && !isValidPin(pin)) {
    return { error: "PIN must be 4 to 6 digits.", ok: false };
  }

  const service = createServiceRoleClient();

  try {
    const adminId = randomUUID();
    await createUser(service, {
      id: adminId,
      name,
      email,
      role: "admin",
      company_id: companyId,
      auth_user_id: null,
      pin_hash: pin ? hashPin(adminId, pin) : null,
      can_sell: true,
      must_change_password: true,
    });
    await syncAuthPassword({
      userId: adminId,
      email,
      password,
      authUserId: null,
    });
  } catch (error) {
    return { error: errorMessage(error), ok: false };
  }

  revalidatePath(`/platform/companies/${companyId}`);
  revalidatePath("/platform");
  return { error: null, ok: true };
}

export async function setCompanyActive(formData: FormData): Promise<void> {
  await requireSuperadmin();
  const companyId = String(formData.get("company_id") ?? "");
  const isActive = String(formData.get("is_active") ?? "") === "true";
  if (!companyId) return;

  const service = createServiceRoleClient();
  const { error } = await service
    .from("companies")
    .update({ is_active: isActive })
    .eq("id", companyId);
  if (error) throw new Error(error.message);

  revalidatePath("/platform");
  revalidatePath(`/platform/companies/${companyId}`);
}

export async function openCompany(formData: FormData): Promise<void> {
  const { user } = await requireSuperadmin();
  const companyId = String(formData.get("company_id") ?? "");
  if (!companyId) return;

  const supabase = await getServerClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  if (!authUser) redirect("/login");

  const service = createServiceRoleClient();
  const { error } = await service.auth.admin.updateUserById(authUser.id, {
    app_metadata: {
      ...authUser.app_metadata,
      acting_company_id: companyId,
    },
  });
  if (error) throw new Error(error.message);

  const { error: refreshError } = await supabase.auth.refreshSession();
  if (refreshError) throw new Error(refreshError.message);

  void user;
  redirect("/");
}

export async function exitCompany(): Promise<void> {
  await requireSuperadmin();

  const supabase = await getServerClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  if (!authUser) redirect("/login");

  const rest = { ...authUser.app_metadata };
  delete rest.acting_company_id;

  const service = createServiceRoleClient();
  const { error } = await service.auth.admin.updateUserById(authUser.id, {
    app_metadata: rest,
  });
  if (error) throw new Error(error.message);

  const { error: refreshError } = await supabase.auth.refreshSession();
  if (refreshError) throw new Error(refreshError.message);

  redirect("/platform" as Route);
}

export async function resetCompanyUserPassword(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireSuperadmin();

  const id = String(formData.get("id") ?? "");
  const password = String(formData.get("password") ?? "");
  const mustChangePassword = formData.get("must_change_password") === "true";

  if (!id) return { error: "Missing user.", ok: false };
  if (password.length < 6) {
    return { error: "Password must be at least 6 characters.", ok: false };
  }

  const service = createServiceRoleClient();

  try {
    const { data: row, error } = await service
      .from("users")
      .select("id, email, role, auth_user_id, company_id")
      .eq("id", id)
      .single();
    if (error) throw new Error(error.message);
    if (row.role === "superadmin") {
      return { error: "Cannot reset another superadmin.", ok: false };
    }
    if (row.role !== "admin" && row.role !== "device") {
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
    if (row.company_id) revalidatePath(`/platform/companies/${row.company_id}`);
  } catch (error) {
    return { error: errorMessage(error), ok: false };
  }

  return { error: null, ok: true };
}

export async function resetCompanyUserPin(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireSuperadmin();

  const id = String(formData.get("id") ?? "");
  const pin = String(formData.get("pin") ?? "").trim();

  if (!id) return { error: "Missing user.", ok: false };
  if (!isValidPin(pin)) {
    return { error: "The PIN must be 4 to 6 digits.", ok: false };
  }

  const service = createServiceRoleClient();

  try {
    const { data: row, error } = await service
      .from("users")
      .select("id, role, company_id")
      .eq("id", id)
      .single();
    if (error) throw new Error(error.message);
    if (row.role === "superadmin") {
      return { error: "Cannot reset another superadmin.", ok: false };
    }
    if (row.role !== "cashier" && row.role !== "admin") {
      return { error: "Terminals unlock with an Auth password, not a PIN.", ok: false };
    }

    await updateUser(service, id, { pin_hash: hashPin(id, pin) });
    if (row.company_id) revalidatePath(`/platform/companies/${row.company_id}`);
  } catch (error) {
    return { error: errorMessage(error), ok: false };
  }

  return { error: null, ok: true };
}
