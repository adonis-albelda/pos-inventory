"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { InventoryMovement } from "@double-a/shared-types";
import {
  countOpenPurchaseOrders,
  getPurchaseOrder,
  listMovementsPage,
  listPurchaseOrders,
  listUpcomingSupplierPayments,
  sumSupplierBalance,
  type PurchaseOrdersFilter,
} from "@double-a/api-client/queries";
import { getBrowserApiClient } from "@/lib/api/browser-client";
import { queryKeys } from "./keys";

/** Single-page fetch (up to 200), same as the Server Component this replaced — paginated client-side. */
export function usePurchaseOrders(filter: PurchaseOrdersFilter & { limit?: number } = {}) {
  return useQuery({
    queryKey: queryKeys.purchaseOrders.list(filter as Record<string, unknown>),
    queryFn: () => listPurchaseOrders(getBrowserApiClient(), filter),
  });
}

export function usePurchaseOrder(id: string) {
  return useQuery({
    queryKey: queryKeys.purchaseOrders.detail(id),
    queryFn: () => getPurchaseOrder(getBrowserApiClient(), id),
    enabled: Boolean(id),
  });
}

export function useUpcomingSupplierPayments(days?: number) {
  return useQuery({
    queryKey: queryKeys.purchaseOrders.upcomingPayments(),
    queryFn: () => listUpcomingSupplierPayments(getBrowserApiClient(), days),
  });
}

/** Count of orders in "ordered" or "partially_received" status — the dashboard's "Open purchase orders" card. */
export function useOpenPurchaseOrdersCount() {
  return useQuery({
    queryKey: ["purchase-orders", "open-count"] as const,
    queryFn: () => countOpenPurchaseOrders(getBrowserApiClient()),
  });
}

/** Unpaid installment total across every open (non-cancelled) purchase order — the dashboard's "Supplier balance" card. */
export function useSupplierBalanceTotal() {
  return useQuery({
    queryKey: ["purchase-orders", "balance"] as const,
    queryFn: () => sumSupplierBalance(getBrowserApiClient()),
  });
}

/**
 * GAP: IndexInventoryMovementsController has no `reference_id` filter (see
 * queries/inventory.ts) — walks recent shop-wide movements looking for this
 * order's, capped rather than a full unbounded scan. Key is namespaced under
 * "purchase-orders" (not "inventory") so useInvalidatePurchaseOrders() below
 * catches it too — receiving a line changes both the PO and its movements.
 */
export function usePurchaseOrderMovements(purchaseOrderId: string) {
  return useQuery({
    queryKey: ["purchase-orders", "detail", purchaseOrderId, "movements"] as const,
    queryFn: async () => {
      const client = getBrowserApiClient();
      const MOVEMENT_SCAN_CAP = 2000;
      const movements: InventoryMovement[] = [];
      let scanned = 0;
      for (let page = 1; scanned < MOVEMENT_SCAN_CAP; page += 1) {
        const result = await listMovementsPage(client, { page, pageSize: 200 });
        scanned += result.movements.length;
        movements.push(
          ...result.movements.filter(
            (m) => m.referenceId === purchaseOrderId && m.reason === "restock",
          ),
        );
        if (page >= result.lastPage) break;
      }
      return movements;
    },
    enabled: Boolean(purchaseOrderId),
  });
}

/**
 * Call after receivePurchaseOrderItemAction/markPaymentPaidAction/
 * markPaymentUnpaidAction/updatePurchaseOrderStatusAction (Server Actions)
 * succeed — revalidatePath doesn't touch this cache.
 */
export function useInvalidatePurchaseOrders() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: queryKeys.purchaseOrders.all });
}
