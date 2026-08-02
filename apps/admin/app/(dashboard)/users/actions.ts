"use server";

import { createHash, randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { isValidPin, pinHashInput } from "@double-a/shared-types";
import { createUser, updateUser } from "@double-a/supabase";
import type { FormState } from "@/lib/form-state";
import { getServerClient } from "@/lib/supabase/server";

function hashPin(userId: string, pin: string): string {
  return createHash("sha256").update(pinHashInput(userId, pin)).digest("hex");
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

  if (!name) return { error: "Name is required.", ok: false };
  if (!email) return { error: "Email is required — it identifies the person.", ok: false };
  if (pin && !isValidPin(pin)) {
    return { error: "The PIN must be 4 to 6 digits.", ok: false };
  }
  if (!id && !pin && role === "cashier") {
    return { error: "Set a PIN so this cashier can unlock a terminal.", ok: false };
  }

  const supabase = await getServerClient();

  try {
    if (id) {
      await updateUser(supabase, id, {
        name,
        email,
        role,
        ...(pin ? { pin_hash: hashPin(id, pin) } : {}),
      });
    } else {
      // The id is generated here rather than by the server because the PIN hash
      // is salted with it, and both have to be written in one insert.
      const newId = randomUUID();
      await createUser(supabase, {
        id: newId,
        name,
        email,
        role,
        pin_hash: pin ? hashPin(newId, pin) : null,
      });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return {
      error: message.includes("users_email_key")
        ? "That email is already used by another person."
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
