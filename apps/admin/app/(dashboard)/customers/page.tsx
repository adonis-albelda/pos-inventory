import { Users } from "lucide-react";
import { listCustomers, listSales } from "@double-a/supabase";
import { getServerClient } from "@/lib/supabase/server";
import { matchesQuery, paginateItems, parseListQuery } from "@/lib/list-query";
import { PageHeader } from "@/components/ui";
import { CustomersPanel } from "./customers-panel";

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const params = await searchParams;
  const { q, page } = parseListQuery(params);
  const supabase = await getServerClient();
  const customers = await listCustomers(supabase);

  // Sale counts in one pass rather than N+1. Cap is high enough for a shop
  // that has been open a few years; older history still links from the detail.
  const sales = await listSales(supabase, { limit: 2000 });
  const saleCounts: Record<string, number> = {};
  for (const sale of sales) {
    if (!sale.customerId) continue;
    saleCounts[sale.customerId] = (saleCounts[sale.customerId] ?? 0) + 1;
  }

  const filtered = customers.filter((customer) =>
    matchesQuery([customer.name, customer.contact, customer.address], q),
  );
  const { pageItems, page: safePage, pageCount, total, pageSize } = paginateItems(
    filtered,
    page,
  );

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Users}
        title="Customers"
        description="Reusable accounts linked from the counter. Every sale still keeps its own name snapshot."
      />

      <CustomersPanel
        customers={pageItems}
        saleCounts={saleCounts}
        query={q}
        page={safePage}
        pageCount={pageCount}
        total={total}
        pageSize={pageSize}
      />
    </div>
  );
}
