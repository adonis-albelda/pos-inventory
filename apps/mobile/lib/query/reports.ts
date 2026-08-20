import { useQuery } from "@tanstack/react-query";
import {
  reportByCashier,
  reportByDevice,
  reportDeadStock,
  reportDiscounts,
  reportInventoryValuation,
  reportProfit,
  reportTopProducts,
  type DateRange,
} from "@double-a/api-client/queries";
import { getAdminApiClient, getApiClient } from "@/lib/api/session";
import { queryKeys } from "./keys";

/**
 * One hook per `packages/api-client/src/queries/reports.ts` function — mirrors
 * apps/admin/lib/query/reports.ts's shape (read-only, no invalidate hook,
 * one cache entry per range/limit/days so flipping between presets doesn't
 * refetch ranges already seen this session). Online-only, same as every
 * other app/admin/** screen: straight to the Tally API, no SQLite involved.
 *
 * Inventory valuation and dead stock are the two report controllers that
 * actually gate on actsAsAdmin() server-side (see ReportInventoryValuation/
 * ReportDeadStockController) — those two need the admin token. The rest
 * (profit, top products, discounts, by-cashier, by-device) only require
 * `#[Authenticated]`, so the device token already works for them.
 */

export function useReportProfit(range: DateRange) {
  return useQuery({
    queryKey: queryKeys.reports.profit({ ...range }),
    queryFn: () => reportProfit(getApiClient(), range),
  });
}

export function useReportTopProducts(range: DateRange, limit = 20) {
  return useQuery({
    queryKey: queryKeys.reports.topProducts({ ...range }, limit),
    queryFn: () => reportTopProducts(getApiClient(), range, limit),
  });
}

export function useReportDiscounts(range: DateRange) {
  return useQuery({
    queryKey: queryKeys.reports.discounts({ ...range }),
    queryFn: () => reportDiscounts(getApiClient(), range),
  });
}

export function useReportByCashier(range: DateRange) {
  return useQuery({
    queryKey: queryKeys.reports.byCashier({ ...range }),
    queryFn: () => reportByCashier(getApiClient(), range),
  });
}

export function useReportByDevice(range: DateRange) {
  return useQuery({
    queryKey: queryKeys.reports.byDevice({ ...range }),
    queryFn: () => reportByDevice(getApiClient(), range),
  });
}

/** No date range — a snapshot of what's on the shelves right now. */
export function useReportInventoryValuation() {
  return useQuery({
    queryKey: queryKeys.reports.inventoryValuation(),
    queryFn: () => reportInventoryValuation(getAdminApiClient()),
  });
}

export function useReportDeadStock(days = 60) {
  return useQuery({
    queryKey: queryKeys.reports.deadStock(days),
    queryFn: () => reportDeadStock(getAdminApiClient(), days),
  });
}
