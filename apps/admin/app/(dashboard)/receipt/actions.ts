"use server";

import { revalidatePath } from "next/cache";
import { currentAppUser, updateReceiptLayout } from "@double-a/supabase";
import type { FormState } from "@/lib/form-state";
import { getServerClient } from "@/lib/supabase/server";
import { isShopAdmin } from "@/lib/authz";

function checked(formData: FormData, key: string): boolean {
  return formData.get(key) === "true" || formData.get(key) === "on";
}

export async function saveReceiptLayout(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const supabase = await getServerClient();
  const user = await currentAppUser(supabase);
  if (!isShopAdmin(user)) {
    return { error: "Only the owner can edit the receipt layout.", ok: false };
  }

  try {
    await updateReceiptLayout(supabase, {
      show_shop_name: checked(formData, "show_shop_name"),
      show_address: checked(formData, "show_address"),
      show_phone: checked(formData, "show_phone"),
      show_logo_line: checked(formData, "show_logo_line"),
      show_cashier: checked(formData, "show_cashier"),
      show_terminal: checked(formData, "show_terminal"),
      show_customer: checked(formData, "show_customer"),
      show_discounts: checked(formData, "show_discounts"),
      show_payment: checked(formData, "show_payment"),
      show_footer: checked(formData, "show_footer"),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return { error: `Could not save the receipt layout: ${message}`, ok: false };
  }

  revalidatePath("/receipt");
  return { error: null, ok: true };
}
