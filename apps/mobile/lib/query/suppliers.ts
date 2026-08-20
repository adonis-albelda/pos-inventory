import { useQuery, useQueryClient } from "@tanstack/react-query";
import { listSupplierBalances, listSuppliers } from "@double-a/api-client/queries";
import { getAdminApiClient } from "@/lib/api/session";
import { queryKeys } from "./keys";

export function useSuppliers(options: { includeInactive?: boolean } = {}) {
  return useQuery({
    queryKey: queryKeys.suppliers.list(options),
    queryFn: () => listSuppliers(getAdminApiClient(), options),
  });
}

/**
 * Every supplier's outstanding balance in one map, for the list row badge.
 * Fans out N per-supplier `/suppliers/{id}/balance` calls under the hood
 * (see the GAP note on `listSupplierBalances` in api-client) — fine for a
 * shop-sized supplier list. Kept under the `suppliers.all` prefix (not one
 * of keys.ts's per-id `balance(id)` entries) so useInvalidateSuppliers()
 * still evicts it, mirroring apps/admin/lib/query/suppliers.ts.
 */
export function useSupplierBalances() {
  return useQuery({
    queryKey: [...queryKeys.suppliers.all, "balances"] as const,
    queryFn: () => listSupplierBalances(getAdminApiClient()),
  });
}

/** Call after createSupplier/updateSupplier/deleteSupplier succeed. */
export function useInvalidateSuppliers() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: queryKeys.suppliers.all });
}
