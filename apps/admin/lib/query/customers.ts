"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getCustomer, listCustomers } from "@double-a/api-client/queries";
import { getBrowserApiClient } from "@/lib/api/browser-client";
import { queryKeys } from "./keys";

export function useCustomers() {
  return useQuery({
    queryKey: queryKeys.customers.list(),
    queryFn: () => listCustomers(getBrowserApiClient()),
  });
}

export function useCustomer(id: string) {
  return useQuery({
    queryKey: queryKeys.customers.detail(id),
    queryFn: () => getCustomer(getBrowserApiClient(), id),
    enabled: Boolean(id),
  });
}

/** Call after saveCustomer/removeCustomer (Server Actions) succeed — revalidatePath doesn't touch this cache. */
export function useInvalidateCustomers() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: queryKeys.customers.all });
}
