import { useQuery, useQueryClient } from "@tanstack/react-query";
import { listExpenses, type ExpenseDayRange } from "@double-a/api-client/queries";
import { getAdminApiClient } from "@/lib/api/session";
import { queryKeys } from "./keys";

/** No range = every expense (list screen). Pass a range for a day-bounded read later if needed. */
export function useExpenses(range?: ExpenseDayRange) {
  return useQuery({
    queryKey: queryKeys.expenses.list({ ...range }),
    queryFn: () => listExpenses(getAdminApiClient(), range),
  });
}

/** Call after createExpense/updateExpense/deleteExpense succeed. */
export function useInvalidateExpenses() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: queryKeys.expenses.all });
}
