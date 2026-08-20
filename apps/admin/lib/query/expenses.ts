"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { listExpenses, sumExpenses, type ExpenseDayRange } from "@double-a/api-client/queries";
import { getBrowserApiClient } from "@/lib/api/browser-client";
import { queryKeys } from "./keys";

/** No range = every expense (list page). Pass a range for a day-bounded read (dashboard/reports). */
export function useExpenses(range?: ExpenseDayRange) {
  return useQuery({
    queryKey: queryKeys.expenses.list({ ...range }),
    queryFn: () => listExpenses(getBrowserApiClient(), range),
  });
}

/** Just the total for a shop-day range — CLAUDE.md §14's Net = revenue − expenses card, no row list needed. */
export function useExpensesTotal(range: ExpenseDayRange) {
  return useQuery({
    queryKey: queryKeys.expenses.sum({ ...range }),
    queryFn: () => sumExpenses(getBrowserApiClient(), range),
  });
}

/** Call after saveExpense/removeExpense (Server Actions) succeed — revalidatePath doesn't touch this cache. */
export function useInvalidateExpenses() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: queryKeys.expenses.all });
}
