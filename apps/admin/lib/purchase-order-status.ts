import type { PurchaseOrderStatus } from "@double-a/shared-types";

/** One badge tone per status, shared by every screen that shows a PO. */
export const PO_STATUS_TONE: Record<
  PurchaseOrderStatus,
  "success" | "warning" | "danger" | "neutral"
> = {
  draft: "neutral",
  ordered: "warning",
  partially_received: "warning",
  received: "success",
  cancelled: "danger",
};
