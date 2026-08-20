import { useQuery, useQueryClient } from "@tanstack/react-query";
import { listUsers } from "@double-a/api-client/queries";
import { getAdminApiClient } from "@/lib/api/session";
import { queryKeys } from "./keys";

/**
 * Admin user directory. Built here only to join cashier names onto sales —
 * `SaleResource` carries `userId` but no name (see
 * packages/api-client/src/queries/sales.ts GAP note). If a parallel "Users"
 * admin screen already owns this file by the time you read this, prefer
 * that version; this hook's shape (`useUsers(options)`) is meant to match
 * `useCategories`'s pattern so the two can coexist without churn.
 */
export function useUsers(options: { includeInactive?: boolean } = {}) {
  return useQuery({
    queryKey: queryKeys.users.list(options),
    queryFn: () => listUsers(getAdminApiClient(), options),
  });
}

/** Call after createUser/updateUser/setUserPin/deleteUser succeed. */
export function useInvalidateUsers() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: queryKeys.users.all });
}
