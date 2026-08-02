"use server";

import { revalidatePath } from "next/cache";
import {
  createCustomer,
  deleteCustomer,
  updateCustomer,
} from "@double-a/supabase";
import {
  CUSTOMER_FIELD_MAX_LENGTH,
  normaliseCustomerDetails,
} from "@double-a/shared-types";
import type { FormState } from "@/lib/form-state";
import { getServerClient } from "@/lib/supabase/server";

function revalidateCustomerViews(id?: string) {
  revalidatePath("/customers");
  revalidatePath("/sales");
  if (id) revalidatePath(`/customers/${id}`);
}

export async function saveCustomer(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const id = String(formData.get("id") ?? "").trim();
  const details = normaliseCustomerDetails({
    name: String(formData.get("name") ?? ""),
    address: String(formData.get("address") ?? ""),
    contact: String(formData.get("contact") ?? ""),
  });

  if (!details.name) {
    return { error: "Give the customer a name.", ok: false };
  }

  const supabase = await getServerClient();
  const row = {
    name: details.name.slice(0, CUSTOMER_FIELD_MAX_LENGTH),
    address: details.address,
    contact: details.contact,
  };

  try {
    if (id) {
      await updateCustomer(supabase, id, row);
      revalidateCustomerViews(id);
    } else {
      const created = await createCustomer(supabase, row);
      revalidateCustomerViews(created.id);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return { error: `Could not save the customer: ${message}`, ok: false };
  }

  return { error: null, ok: true };
}

export async function removeCustomer(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  const supabase = await getServerClient();
  await deleteCustomer(supabase, id);
  revalidateCustomerViews();
}
