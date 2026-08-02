import { Users } from "lucide-react";
import { listUsers } from "@double-a/supabase";
import { getServerClient } from "@/lib/supabase/server";
import { matchesQuery, paginateItems, parseListQuery } from "@/lib/list-query";
import { PageHeader } from "@/components/ui";
import { UsersPanel } from "./users-panel";

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const params = await searchParams;
  const { q, page } = parseListQuery(params);
  const supabase = await getServerClient();
  const users = await listUsers(supabase, { includeInactive: true });

  const filtered = users.filter((user) => matchesQuery([user.name, user.email, user.role], q));
  const { pageItems, page: safePage, pageCount, total, pageSize } = paginateItems(
    filtered,
    page,
  );

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Users}
        title="Cashiers"
        description="Who can ring up a sale, and on which terminals."
      />

      <UsersPanel
        users={pageItems}
        query={q}
        page={safePage}
        pageCount={pageCount}
        total={total}
        pageSize={pageSize}
      />
    </div>
  );
}
