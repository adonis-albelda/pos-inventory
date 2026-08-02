"use server";

import { revalidatePath } from "next/cache";
import { updateSaleFlags, voidSale } from "@double-a/supabase";
import { getServerClient } from "@/lib/supabase/server";

/**
 * Voiding is the only reversal — a sale is never deleted. A trigger puts the
 * stock back as a void_restore movement.
 */
export async function voidSaleAction(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const supabase = await getServerClient();
  await voidSale(supabase, id);

  revalidatePath(`/sales/${id}`);
  revalidatePath("/sales");
  revalidatePath("/inventory");
  revalidatePath("/");
}

export async function patchSaleFlagsAction(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const isPaidRaw = formData.get("is_paid");
  const deliveryRaw = formData.get("delivery_completed");
  const fulfillmentRaw = formData.get("fulfillment");

  const supabase = await getServerClient();
  await updateSaleFlags(supabase, id, {
    ...(isPaidRaw !== null ? { isPaid: isPaidRaw === "true" } : {}),
    ...(deliveryRaw !== null
      ? { deliveryCompleted: deliveryRaw === "true" }
      : {}),
    ...(typeof fulfillmentRaw === "string" && fulfillmentRaw
      ? { fulfillment: fulfillmentRaw }
      : {}),
  });

  revalidatePath(`/sales/${id}`);
  revalidatePath("/sales");
  revalidatePath("/customers");
}
