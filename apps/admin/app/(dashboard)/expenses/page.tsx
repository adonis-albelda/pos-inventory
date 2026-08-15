import { TriangleAlert, Wallet } from "lucide-react";
import { currentAppUser, listExpenses } from "@double-a/supabase";
import { getServerClient } from "@/lib/supabase/server";
import { isShopAdmin } from "@/lib/authz";
import { matchesQuery, paginateItems, parseListQuery } from "@/lib/list-query";
import { storeToday } from "@/lib/date-range";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { ExpensesPanel } from "./expenses-panel";

export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const params = await searchParams;
  const { q, page } = parseListQuery(params);
  const supabase = await getServerClient();
  const user = await currentAppUser(supabase);

  if (!isShopAdmin(user)) {
    return (
      <div className="space-y-6">
        <PageHeader icon={Wallet} title="Expenses" />
        <Card>
          <EmptyState
            icon={TriangleAlert}
            title="Expenses are for the owner's account"
            instruction="Only an admin can log outlays and see them on the books."
          />
        </Card>
      </div>
    );
  }

  const expenses = await listExpenses(supabase);
  const filtered = expenses.filter((expense) =>
    matchesQuery(
      [expense.description, expense.category, expense.note],
      q,
    ),
  );
  const { pageItems, page: safePage, pageCount, total, pageSize } = paginateItems(
    filtered,
    page,
  );

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Wallet}
        title="Expenses"
        description="Rent, utilities, wages and other outlays. Dashboard net is revenue minus these."
      />

      <ExpensesPanel
        expenses={pageItems}
        defaultDate={storeToday()}
        query={q}
        page={safePage}
        pageCount={pageCount}
        total={total}
        pageSize={pageSize}
      />
    </div>
  );
}
