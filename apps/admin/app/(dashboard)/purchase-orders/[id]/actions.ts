"use server";

import { revalidatePath } from "next/cache";
import type { PurchaseOrderStatus } from "@double-a/shared-types";
import {
  currentAppUser,
  markPaymentPaid,
  markPaymentUnpaid,
  receivePurchaseOrderItem,
  setPurchaseOrderStatus,
} from "@double-a/supabase";
import { getServerClient } from "@/lib/supabase/server";

/** draft -> ordered and (draft | ordered) -> cancelled are the only manual jumps. */
const MANUAL_STATUSES: PurchaseOrderStatus[] = ["ordered", "cancelled"];

function revalidatePurchaseOrderViews(id: string) {
  revalidatePath(`/purchase-orders/${id}`);
  revalidatePath("/purchase-orders");
  revalidatePath("/suppliers");
  revalidatePath("/");
}

async function adminContext() {
  const supabase = await getServerClient();
  const user = await currentAppUser(supabase);
  if (user?.role !== "admin") return null;
  return { supabase, user };
}

export async function receivePurchaseOrderItemAction(
  formData: FormData,
): Promise<{ error: string | null }> {
  const itemId = String(formData.get("item_id") ?? "");
  const purchaseOrderId = String(formData.get("purchase_order_id") ?? "");
  const productId = String(formData.get("product_id") ?? "") || null;
  const quantity = Number(formData.get("quantity") ?? 0);

  if (!itemId || !purchaseOrderId) return { error: "Missing line item." };
  if (!Number.isFinite(quantity) || quantity <= 0) {
    return { error: "Enter how many actually arrived." };
  }

  const ctx = await adminContext();
  if (!ctx) return { error: "Only the owner can receive stock on a purchase order." };

  try {
    await receivePurchaseOrderItem(ctx.supabase, {
      itemId,
      purchaseOrderId,
      productId,
      quantity: Math.round(quantity),
      createdBy: ctx.user.id,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return { error: message };
  }

  revalidatePurchaseOrderViews(purchaseOrderId);
  return { error: null };
}

export async function markPaymentPaidAction(formData: FormData): Promise<void> {
  const paymentId = String(formData.get("payment_id") ?? "");
  const purchaseOrderId = String(formData.get("purchase_order_id") ?? "");
  if (!paymentId) return;

  const ctx = await adminContext();
  if (!ctx) return;

  await markPaymentPaid(ctx.supabase, paymentId);
  revalidatePurchaseOrderViews(purchaseOrderId);
}

export async function markPaymentUnpaidAction(formData: FormData): Promise<void> {
  const paymentId = String(formData.get("payment_id") ?? "");
  const purchaseOrderId = String(formData.get("purchase_order_id") ?? "");
  if (!paymentId) return;

  const ctx = await adminContext();
  if (!ctx) return;

  await markPaymentUnpaid(ctx.supabase, paymentId);
  revalidatePurchaseOrderViews(purchaseOrderId);
}

export async function updatePurchaseOrderStatusAction(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!id || !MANUAL_STATUSES.includes(status as PurchaseOrderStatus)) return;

  const ctx = await adminContext();
  if (!ctx) return;

  await setPurchaseOrderStatus(ctx.supabase, id, status as PurchaseOrderStatus);
  revalidatePurchaseOrderViews(id);
}
