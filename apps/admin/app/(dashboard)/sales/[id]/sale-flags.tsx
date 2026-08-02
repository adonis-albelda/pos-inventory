"use client";

import { Button } from "@/components/ui";
import { patchSaleFlagsAction } from "./actions";

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
  return (
    <div className="flex flex-wrap gap-2">
      <form action={patchSaleFlagsAction}>
        <input type="hidden" name="id" value={saleId} />
        <input type="hidden" name="is_paid" value={String(!isPaid)} />
        <Button type="submit" variant="secondary" size="sm">
          {isPaid ? "Mark unpaid" : "Mark paid"}
        </Button>
      </form>

      {fulfillment === "pickup" ? (
        <form action={patchSaleFlagsAction}>
          <input type="hidden" name="id" value={saleId} />
          <input type="hidden" name="fulfillment" value="delivery" />
          <Button type="submit" variant="secondary" size="sm">
            Mark as delivery
          </Button>
        </form>
      ) : (
        <>
          <form action={patchSaleFlagsAction}>
            <input type="hidden" name="id" value={saleId} />
            <input type="hidden" name="fulfillment" value="pickup" />
            <input type="hidden" name="delivery_completed" value="false" />
            <Button type="submit" variant="secondary" size="sm">
              Mark as pickup
            </Button>
          </form>
          <form action={patchSaleFlagsAction}>
            <input type="hidden" name="id" value={saleId} />
            <input
              type="hidden"
              name="delivery_completed"
              value={String(!deliveryCompleted)}
            />
            <Button type="submit" variant="secondary" size="sm">
              {deliveryCompleted ? "Reopen delivery" : "Mark delivered"}
            </Button>
          </form>
        </>
      )}
    </div>
  );
}
