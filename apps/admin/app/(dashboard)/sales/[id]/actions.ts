"use server";

import { revalidatePath } from "next/cache";
import { patchSaleFlags, voidSale } from "@double-a/api-client/queries";
import { getAuthedClient } from "@/lib/api/session";

/**
 * Voiding is the only reversal — a sale is never deleted. Laravel's
 * SaleObserver restores stock as the sale flips to voided.
 */
export async function voidSaleAction(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  await voidSale(getAuthedClient(), id);

  revalidatePath(`/sales/${id}`);
  revalidatePath("/sales");
  revalidatePath("/inventory");
  revalidatePath("/");
}

/** Both flags are required together — see sale-flags.tsx. fulfillment can no longer be changed here. */
export async function patchSaleFlagsAction(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const isPaid = formData.get("is_paid") === "true";
  const deliveryCompleted = formData.get("delivery_completed") === "true";

  await patchSaleFlags(getAuthedClient(), id, { isPaid, deliveryCompleted });

  revalidatePath(`/sales/${id}`);
  revalidatePath("/sales");
  revalidatePath("/customers");
}
