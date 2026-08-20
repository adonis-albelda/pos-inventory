"use client";

import { useState, useTransition } from "react";
import { PackageCheck } from "lucide-react";
import { Button, Input } from "@/components/ui";
import { useInvalidatePurchaseOrders } from "@/lib/query/purchase-orders";
import { receivePurchaseOrderItemAction } from "./actions";

export function ReceiveLineForm({
  itemId,
  purchaseOrderId,
  productId,
  currentReceived,
  remaining,
}: {
  itemId: string;
  purchaseOrderId: string;
  productId: string | null;
  /** The line's quantityReceived before this receipt — the API takes an absolute value, not a delta. */
  currentReceived: number;
  remaining: number;
}) {
  const [quantity, setQuantity] = useState(String(remaining));
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const invalidate = useInvalidatePurchaseOrders();

  function submit() {
    setError(null);
    const form = new FormData();
    form.set("item_id", itemId);
    form.set("purchase_order_id", purchaseOrderId);
    form.set("product_id", productId ?? "");
    form.set("current_received", String(currentReceived));
    form.set("quantity", quantity);

    startTransition(async () => {
      const result = await receivePurchaseOrderItemAction(form);
      if (result.error) {
        setError(result.error);
      } else {
        invalidate();
      }
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center justify-end gap-1.5">
        <Input
          type="number"
          min="0.001"
          max={remaining}
          step="0.001"
          value={quantity}
          onChange={(event) => setQuantity(event.target.value)}
          className="num h-9 w-20 text-right"
          aria-label="Quantity received now"
        />
        <Button type="button" size="sm" icon={PackageCheck} loading={pending} onClick={submit}>
          Receive
        </Button>
      </div>
      {error ? <p className="max-w-44 text-right text-caption text-danger">{error}</p> : null}
    </div>
  );
}
