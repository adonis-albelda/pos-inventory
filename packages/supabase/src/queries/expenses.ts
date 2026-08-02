import type { Expense } from "@double-a/shared-types";
import { roundMoney } from "@double-a/shared-types";
import type { DoubleAClient } from "../client-browser";
import type { TablesInsert, TablesUpdate } from "../database.types";
import { toExpense } from "../mappers";

export interface ExpenseDayRange {
  /** Inclusive shop day, yyyy-mm-dd. */
  fromDay: string;
  /** Inclusive shop day, yyyy-mm-dd. */
  toDay: string;
}

/**
 * Newest first. Optional day filter matches the shop calendar column, not
 * created_at — an expense dated yesterday belongs on yesterday's P&L.
 */
export async function listExpenses(
  client: DoubleAClient,
  range?: ExpenseDayRange,
): Promise<Expense[]> {
  let query = client.from("expenses").select("*").order("expense_date", {
    ascending: false,
  });

  if (range) {
    query = query
      .gte("expense_date", range.fromDay)
      .lte("expense_date", range.toDay);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map(toExpense);
}

export async function sumExpenses(
  client: DoubleAClient,
  range: ExpenseDayRange,
): Promise<number> {
  const { data, error } = await client
    .from("expenses")
    .select("amount")
    .gte("expense_date", range.fromDay)
    .lte("expense_date", range.toDay);

  if (error) throw error;
  return roundMoney(
    (data ?? []).reduce((sum, row) => sum + Number(row.amount), 0),
  );
}

export async function createExpense(
  client: DoubleAClient,
  input: TablesInsert<"expenses">,
): Promise<Expense> {
  const { data, error } = await client
    .from("expenses")
    .insert(input)
    .select("*")
    .single();

  if (error) throw error;
  return toExpense(data);
}

export async function updateExpense(
  client: DoubleAClient,
  id: string,
  patch: TablesUpdate<"expenses">,
): Promise<Expense> {
  const { data, error } = await client
    .from("expenses")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();

  if (error) throw error;
  return toExpense(data);
}

export async function deleteExpense(
  client: DoubleAClient,
  id: string,
): Promise<void> {
  const { error } = await client.from("expenses").delete().eq("id", id);
  if (error) throw error;
}
