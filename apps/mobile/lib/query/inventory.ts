import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  listBelowReorder,
  listMovementsPage,
  listOversold,
  type MovementFilter,
} from "@double-a/api-client/queries";
import { getApiClient } from "@/lib/api/session";
import { queryKeys } from "./keys";

export function useMovements(
  options: MovementFilter & { page?: number; pageSize?: number } = {},
) {
  return useQuery({
    queryKey: queryKeys.inventory.movements({ ...options }),
    queryFn: () => listMovementsPage(getApiClient(), options),
  });
}

export function useOversoldProducts() {
  return useQuery({
    queryKey: queryKeys.inventory.oversold(),
    queryFn: () => listOversold(getApiClient()),
  });
}

export function useBelowReorderProducts() {
  return useQuery({
    queryKey: queryKeys.inventory.belowReorder(),
    queryFn: () => listBelowReorder(getApiClient()),
  });
}

/**
 * Call after adjustStock succeeds. Stock only ever moves through
 * inventory_movements (CLAUDE.md rule 8), so an adjustment invalidates both
 * this domain's cache and, separately, products via the existing
 * useInvalidateProducts() from lib/query/products.ts — stock_quantity lives
 * on the product.
 */
export function useInvalidateInventory() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: queryKeys.inventory.all });
}
