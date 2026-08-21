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
import { getAdminApiClient } from "@/lib/api/session";
import { queryKeys } from "./keys";

/**
 * One hook per `packages/api-client/src/queries/reports.ts` function — mirrors
 * apps/admin/lib/query/reports.ts's shape (read-only, no invalidate hook,
 * one cache entry per range/limit/days so flipping between presets doesn't
 * refetch ranges already seen this session). Online-only, same as every
 * other app/admin/** screen: straight to the Tally API, no SQLite involved.
 *
 * Every one of these seven controllers gates on actsAsAdmin() server-side —
 * profit, top products, discounts, by-cashier and by-device all share
 * ReportDateRangeRequest::authorize(), same as inventory valuation and dead
 * stock — so all seven need the admin token, not the device one.
 */

export function useReportProfit(range: DateRange) {
  return useQuery({
    queryKey: queryKeys.reports.profit({ ...range }),
    queryFn: () => reportProfit(getAdminApiClient(), range),
  });
}

export function useReportTopProducts(range: DateRange, limit = 20) {
  return useQuery({
    queryKey: queryKeys.reports.topProducts({ ...range }, limit),
    queryFn: () => reportTopProducts(getAdminApiClient(), range, limit),
  });
}

export function useReportDiscounts(range: DateRange) {
  return useQuery({
    queryKey: queryKeys.reports.discounts({ ...range }),
    queryFn: () => reportDiscounts(getAdminApiClient(), range),
  });
}

export function useReportByCashier(range: DateRange) {
  return useQuery({
    queryKey: queryKeys.reports.byCashier({ ...range }),
    queryFn: () => reportByCashier(getAdminApiClient(), range),
  });
}

export function useReportByDevice(range: DateRange) {
  return useQuery({
    queryKey: queryKeys.reports.byDevice({ ...range }),
    queryFn: () => reportByDevice(getAdminApiClient(), range),
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
