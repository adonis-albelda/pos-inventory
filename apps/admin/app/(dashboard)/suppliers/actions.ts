"use server";

import { revalidatePath } from "next/cache";
import {
  SUPPLIER_ADDRESS_MAX,
  SUPPLIER_CONTACT_PERSON_MAX,
  SUPPLIER_EMAIL_MAX,
  SUPPLIER_NAME_MAX,
  SUPPLIER_PHONE_MAX,
} from "@double-a/shared-types";
import {
  createSupplier,
  currentAppUser,
  deleteSupplier,
  setSupplierProducts,
  updateSupplier,
} from "@double-a/supabase";
import type { FormState } from "@/lib/form-state";
import { getServerClient } from "@/lib/supabase/server";
import { isShopAdmin } from "@/lib/authz";

function text(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

function optional(formData: FormData, key: string, max: number): string | null {
  const value = text(formData, key);
  return value ? value.slice(0, max) : null;
}

function revalidateSupplierViews(id?: string) {
  revalidatePath("/suppliers");
  revalidatePath("/purchase-orders");
  revalidatePath("/");
  if (id) revalidatePath(`/suppliers/${id}`);
}

export async function saveSupplier(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const id = text(formData, "id");
  const name = text(formData, "name");
  const productIds = text(formData, "product_ids")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  // The active checkbox only renders once a supplier already exists — a new
  // one is always active on creation.
  const isActive = id ? formData.get("is_active") === "true" : true;

  if (!name) {
    return { error: "Give the supplier a name.", ok: false };
  }

  const supabase = await getServerClient();
  const user = await currentAppUser(supabase);
  if (!isShopAdmin(user)) {
    return { error: "Only the owner can manage suppliers.", ok: false };
  }

  const row = {
    name: name.slice(0, SUPPLIER_NAME_MAX),
    contact_person: optional(formData, "contact_person", SUPPLIER_CONTACT_PERSON_MAX),
    phone: optional(formData, "phone", SUPPLIER_PHONE_MAX),
    email: optional(formData, "email", SUPPLIER_EMAIL_MAX),
    address: optional(formData, "address", SUPPLIER_ADDRESS_MAX),
    is_active: isActive,
  };

  try {
    const supplierId = id
      ? (await updateSupplier(supabase, id, row)).id
      : (await createSupplier(supabase, row)).id;
    await setSupplierProducts(supabase, supplierId, productIds);
    revalidateSupplierViews(supplierId);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return { error: `Could not save the supplier: ${message}`, ok: false };
  }

  return { error: null, ok: true };
}

/**
 * `purchase_orders.supplier_id` is `on delete restrict`, so this throws once
 * the supplier has any order history. Returned as a result instead of left to
 * throw, so the button can explain "deactivate instead" rather than crash.
 */
export async function removeSupplier(formData: FormData): Promise<{ error: string | null }> {
  const id = text(formData, "id");
  if (!id) return { error: null };

  const supabase = await getServerClient();
  const user = await currentAppUser(supabase);
  if (!isShopAdmin(user)) {
    return { error: "Only the owner can manage suppliers." };
  }

  try {
    await deleteSupplier(supabase, id);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return {
      error: message.toLowerCase().includes("foreign key")
        ? "This supplier has purchase orders on file and cannot be deleted. Turn off \u201cActive\u201d instead."
        : `Could not delete the supplier: ${message}`,
    };
  }

  revalidateSupplierViews();
  return { error: null };
}
