import { useQuery, useQueryClient } from "@tanstack/react-query";
import { countProductsByCategory, listCategories } from "@double-a/api-client/queries";
import { getApiClient } from "@/lib/api/session";
import { queryKeys } from "./keys";

export function useCategories(options: { includeInactive?: boolean } = {}) {
  return useQuery({
    queryKey: queryKeys.categories.list(options),
    queryFn: () => listCategories(getApiClient(), options),
  });
}

export function useCategoryProductCounts(options: { includeInactive?: boolean } = {}) {
  return useQuery({
    queryKey: queryKeys.categories.productCounts(options),
    queryFn: () => countProductsByCategory(getApiClient(), options),
  });
}

/** Call after createCategory/updateCategory/deleteCategory succeed. */
export function useInvalidateCategories() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: queryKeys.categories.all });
}
