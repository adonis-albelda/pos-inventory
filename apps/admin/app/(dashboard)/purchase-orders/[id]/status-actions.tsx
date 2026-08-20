"use client";

import { useTransition } from "react";
import type { PurchaseOrderStatus } from "@double-a/shared-types";
import { Button } from "@/components/ui";
import { useInvalidatePurchaseOrders } from "@/lib/query/purchase-orders";
import {
  markPaymentPaidAction,
  markPaymentUnpaidAction,
  updatePurchaseOrderStatusAction,
} from "./actions";

/** "Mark as ordered" / "Cancel order" — a Server Action call wrapped so it can invalidate the query cache after it succeeds. */
export function UpdateStatusButton({
  id,
  status,
  label,
  variant = "primary",
}: {
  id: string;
  status: PurchaseOrderStatus;
  label: string;
  variant?: "primary" | "secondary" | "accent" | "danger" | "ghost";
}) {
  const [pending, startTransition] = useTransition();
  const invalidate = useInvalidatePurchaseOrders();

  function submit() {
    const form = new FormData();
    form.set("id", id);
    form.set("status", status);
    startTransition(async () => {
      await updatePurchaseOrderStatusAction(form);
      invalidate();
    });
  }

  return (
    <Button type="button" size="sm" variant={variant} loading={pending} onClick={submit}>
      {label}
    </Button>
  );
}

/** Mark a payment term paid/unpaid — same wrapping as UpdateStatusButton. */
export function PaymentStatusButton({
  paymentId,
  purchaseOrderId,
  isPaid,
}: {
  paymentId: string;
  purchaseOrderId: string;
  isPaid: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const invalidate = useInvalidatePurchaseOrders();

  function submit() {
    const form = new FormData();
    form.set("payment_id", paymentId);
    form.set("purchase_order_id", purchaseOrderId);
    startTransition(async () => {
      await (isPaid ? markPaymentUnpaidAction(form) : markPaymentPaidAction(form));
      invalidate();
    });
  }

  return (
    <Button type="button" variant="secondary" size="sm" loading={pending} onClick={submit}>
      {isPaid ? "Mark unpaid" : "Mark paid"}
    </Button>
  );
}
