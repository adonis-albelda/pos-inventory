"use client";

import type { Product } from "@double-a/shared-types";
import { Sheet } from "@/components/overlay";
import { StockForm } from "./stock-form";

/**
 * One panel for every way stock is recorded by hand, opened from either tab and
 * from a product row, so the wording a person reads is the same each time.
 */
export function RestockSheet({
  open,
  onClose,
  products,
  defaultProductId,
}: {
  open: boolean;
  onClose: () => void;
  products: Product[];
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
        products={products}
        defaultProductId={defaultProductId}
        onDone={onClose}
      />
    </Sheet>
  );
}
