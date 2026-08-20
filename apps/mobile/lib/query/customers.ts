import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getCustomer, listCustomers } from "@double-a/api-client/queries";
import { getApiClient } from "@/lib/api/session";
import { queryKeys } from "./keys";

/** Pulled whole, like the web dashboard's version — the table stays small. */
export function useCustomers() {
  return useQuery({
    queryKey: queryKeys.customers.list(),
    queryFn: () => listCustomers(getApiClient()),
  });
}

export function useCustomer(id: string) {
  return useQuery({
    queryKey: queryKeys.customers.detail(id),
    queryFn: () => getCustomer(getApiClient(), id),
    enabled: Boolean(id),
  });
}

/** Call after createCustomer/updateCustomer/deleteCustomer succeed. */
export function useInvalidateCustomers() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: queryKeys.customers.all });
}
