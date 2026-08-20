"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { listUsers } from "@double-a/api-client/queries";
import { getBrowserApiClient } from "@/lib/api/browser-client";
import { queryKeys } from "./keys";

/** Backs the Users page itself, and also read cross-domain for cashier-name lookups (sales, purchase-orders, etc). */
export function useUsers(options: { includeInactive?: boolean } = {}) {
  return useQuery({
    queryKey: queryKeys.users.list(options),
    queryFn: () => listUsers(getBrowserApiClient(), options),
  });
}

/** Call after saveCashier/toggleUserCanSell/toggleCashierActive (Server Actions) succeed — revalidatePath doesn't touch this cache. */
export function useInvalidateUsers() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: queryKeys.users.all });
}
