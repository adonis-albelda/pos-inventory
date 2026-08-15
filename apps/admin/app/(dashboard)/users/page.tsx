import { Shield, Smartphone, UserRound, Users } from "lucide-react";
import type { UserRole } from "@double-a/shared-types";
import { listUsers } from "@double-a/supabase";
import { getServerClient } from "@/lib/supabase/server";
import { matchesQuery, paginateItems, parseListQuery } from "@/lib/list-query";
import { PageHeader } from "@/components/ui";
import { TabNav } from "@/components/tab-nav";
import { UsersPanel } from "./users-panel";

const USER_TABS: { key: Exclude<UserRole, "superadmin">; label: string }[] = [
  { key: "admin", label: "Admins" },
  { key: "cashier", label: "Cashiers" },
  { key: "device", label: "Terminals" },
];

function buildHref(params: Record<string, string | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) search.set(key, value);
  }
  const query = search.toString();
  return query ? `/users?${query}` : "/users";
}

function parseTab(raw: string | undefined): Exclude<UserRole, "superadmin"> {
  if (raw === "admin" || raw === "cashier" || raw === "device") return raw;
  return "cashier";
}

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; q?: string; page?: string }>;
}) {
  const params = await searchParams;
  const { q, page } = parseListQuery(params);
  const tab = parseTab(params.tab);
  const supabase = await getServerClient();
  const users = await listUsers(supabase, { includeInactive: true });

  const counts = {
    admin: users.filter((user) => user.role === "admin").length,
    cashier: users.filter((user) => user.role === "cashier").length,
    device: users.filter((user) => user.role === "device").length,
  };

  const inTab = users.filter((user) => user.role === tab);
  const filtered = inTab.filter((user) => matchesQuery([user.name, user.email], q));
  const { pageItems, page: safePage, pageCount, total, pageSize } = paginateItems(
    filtered,
    page,
  );

  const tabs = USER_TABS.map((entry) => ({
    key: entry.key,
    label: entry.label,
    icon: entry.key === "admin" ? Shield : entry.key === "device" ? Smartphone : UserRound,
    count: counts[entry.key],
    href: buildHref({ tab: entry.key, q: q || undefined }),
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Users}
        title="Users"
        description="Admins sign in here. Cashiers unlock with a PIN. Terminals enroll once per device."
      />

      <TabNav items={tabs} active={tab} ariaLabel="User roles" />

      <UsersPanel
        tab={tab}
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
