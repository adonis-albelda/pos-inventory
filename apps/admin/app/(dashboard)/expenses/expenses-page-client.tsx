"use client";

import { useSearchParams } from "next/navigation";
import { Wallet } from "lucide-react";
import type { Expense } from "@double-a/shared-types";
import { matchesQuery, paginateItems, parseListQuery } from "@/lib/list-query";
import { storeToday } from "@/lib/date-range";
import { Card, PageHeader } from "@/components/ui";
import { ExpensesPanel } from "./expenses-panel";
import { useExpenses } from "@/lib/query/expenses";

export function ExpensesPageClient() {
  const searchParams = useSearchParams();
  const { q, page } = parseListQuery({
    q: searchParams.get("q") ?? undefined,
    page: searchParams.get("page") ?? undefined,
  });

  const expensesQuery = useExpenses();

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Wallet}
        title="Expenses"
        description="Rent, utilities, wages and other outlays. Dashboard net is revenue minus these."
      />

      {expensesQuery.isPending ? (
        <Card className="px-4 py-8 text-center text-body text-ink-muted">Loading…</Card>
      ) : expensesQuery.isError ? (
        <Card className="px-4 py-8 text-center text-body text-danger">
          {expensesQuery.error instanceof Error
            ? expensesQuery.error.message
            : "Could not load expenses."}
        </Card>
      ) : (
        <ExpensesBody expenses={expensesQuery.data ?? []} q={q} page={page} />
      )}
    </div>
  );
}

function ExpensesBody({ expenses, q, page }: { expenses: Expense[]; q: string; page: number }) {
  const filtered = expenses.filter((expense) =>
    matchesQuery([expense.description, expense.category, expense.note], q),
  );
  const { pageItems, page: safePage, pageCount, total, pageSize } = paginateItems(filtered, page);

  return (
    <ExpensesPanel
      expenses={pageItems}
      defaultDate={storeToday()}
      query={q}
      page={safePage}
      pageCount={pageCount}
      total={total}
      pageSize={pageSize}
    />
  );
}
