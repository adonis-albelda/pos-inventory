import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getPurchaseOrder,
  listPurchaseOrders,
  type PurchaseOrdersFilter,
} from "@double-a/api-client/queries";
import type { PurchaseOrderStatus } from "@double-a/shared-types";
import { getAdminApiClient } from "@/lib/api/session";
import { queryKeys } from "./keys";

/** One badge tone per status, shared by the list and detail screens — mirrors apps/admin's lib/purchase-order-status.ts. */
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

/**
 * Read side only — writes (create/status/receive/payments) are plain
 * `useMutation` calls made directly against the api-client functions from
 * each screen, same shape as categories.ts/suppliers.ts. `PurchaseOrderResource`
 * carries no supplier name (see the GAP note at the top of
 * packages/api-client/src/queries/purchase-orders.ts) — every screen here
 * joins against `useSuppliers()` from lib/query/suppliers.ts client-side.
 */
export function usePurchaseOrders(filter: PurchaseOrdersFilter = {}) {
  return useQuery({
    queryKey: queryKeys.purchaseOrders.list({ ...filter }),
    queryFn: () => listPurchaseOrders(getAdminApiClient(), filter),
  });
}

export function usePurchaseOrder(id: string) {
  return useQuery({
    queryKey: queryKeys.purchaseOrders.detail(id),
    queryFn: () => getPurchaseOrder(getAdminApiClient(), id),
    enabled: Boolean(id),
  });
}

/** Call after any create/update/status/item/payment mutation succeeds. */
export function useInvalidatePurchaseOrders() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: queryKeys.purchaseOrders.all });
}
