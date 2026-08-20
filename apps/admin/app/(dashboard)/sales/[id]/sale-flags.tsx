"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui";
import { useInvalidateSales } from "@/lib/query/sales";
import { patchSaleFlagsAction } from "./actions";

/**
 * GAP: `PATCH /sales/{id}/flags` requires `is_paid`/`delivery_completed`
 * together (no partial patch) and cannot touch `fulfillment` at all (see
 * queries/sales.ts) — the old pickup<->delivery conversion buttons have no
 * backend to call anymore and are dropped; fulfillment is now fixed at
 * whatever the sale synced with.
 */
export function SaleFlags({
  saleId,
  isPaid,
  fulfillment,
  deliveryCompleted,
}: {
  saleId: string;
  isPaid: boolean;
  fulfillment: string;
  deliveryCompleted: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const invalidate = useInvalidateSales();

  function patch(patch: { isPaid: boolean; deliveryCompleted: boolean }) {
    const form = new FormData();
    form.set("id", saleId);
    form.set("is_paid", String(patch.isPaid));
    form.set("delivery_completed", String(patch.deliveryCompleted));
    startTransition(async () => {
      await patchSaleFlagsAction(form);
      invalidate();
    });
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button
        variant="secondary"
        size="sm"
        loading={pending}
        onClick={() => patch({ isPaid: !isPaid, deliveryCompleted })}
      >
        {isPaid ? "Mark unpaid" : "Mark paid"}
      </Button>

      {fulfillment === "delivery" ? (
        <Button
          variant="secondary"
          size="sm"
          loading={pending}
          onClick={() => patch({ isPaid, deliveryCompleted: !deliveryCompleted })}
        >
          {deliveryCompleted ? "Reopen delivery" : "Mark delivered"}
        </Button>
      ) : null}
    </div>
  );
}
