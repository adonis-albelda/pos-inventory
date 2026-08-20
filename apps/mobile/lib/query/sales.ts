import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getSale, listSalesPage, type SalesFilter } from "@double-a/api-client/queries";
import { getApiClient } from "@/lib/api/session";
import { queryKeys } from "./keys";

/**
 * Read + void + flag-patch only — sales are never created from an admin
 * screen (CLAUDE.md rule 3: the mobile POS sync push flow is the only
 * writer, with client-generated UUIDs). See
 * packages/api-client/src/queries/sales.ts for the documented GAPs this
 * mirrors: `IndexSalesController` only filters by customerId/status (no
 * date range, no cashier/device filter — screens needing those page
 * through and filter client-side), and `SaleResource` carries no cashier
 * name (join against `useUsers()` from lib/query/users.ts).
 */
export function useSalesList(filter: SalesFilter = {}) {
  return useQuery({
    queryKey: queryKeys.sales.list({ ...filter }),
    queryFn: () => listSalesPage(getApiClient(), filter),
  });
}

export function useSale(id: string) {
  return useQuery({
    queryKey: queryKeys.sales.detail(id),
    queryFn: () => getSale(getApiClient(), id),
    enabled: Boolean(id),
  });
}

/** Call after voidSale/patchSaleFlags succeed. */
export function useInvalidateSales() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: queryKeys.sales.all });
}
