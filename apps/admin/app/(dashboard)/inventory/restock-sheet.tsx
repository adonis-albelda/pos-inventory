"use client";

import { Sheet } from "@/components/overlay";
import { StockForm } from "./stock-form";

/**
 * One panel for every way stock is recorded by hand, opened from either tab and
 * from a product row, so the wording a person reads is the same each time.
 */
export function RestockSheet({
  open,
  onClose,
  defaultProductId,
}: {
  open: boolean;
  onClose: () => void;
  defaultProductId?: string;
}) {
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Restock or adjust"
      description="Every entry writes a movement row, so stock always equals the sum of its history."
      wide
    >
      <StockForm
        key={defaultProductId ?? "any"}
        defaultProductId={defaultProductId}
        onDone={onClose}
      />
    </Sheet>
  );
}
