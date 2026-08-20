"use client";

import { useSearchParams } from "next/navigation";
import { Shield, Smartphone, UserRound, Users } from "lucide-react";
import type { User, UserRole } from "@double-a/shared-types";
import { matchesQuery, paginateItems, parseListQuery } from "@/lib/list-query";
import { Card, PageHeader } from "@/components/ui";
import { TabNav } from "@/components/tab-nav";
import { UsersPanel } from "./users-panel";
import { useUsers } from "@/lib/query/users";

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

export default function UsersPage() {
  const searchParams = useSearchParams();
  const { q, page } = parseListQuery({
    q: searchParams.get("q") ?? undefined,
    page: searchParams.get("page") ?? undefined,
  });
  const tab = parseTab(searchParams.get("tab") ?? undefined);

  const usersQuery = useUsers({ includeInactive: true });

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Users}
        title="Users"
        description="Admins sign in here. Cashiers unlock with a PIN. Terminals enroll once per device."
      />

      {usersQuery.isPending ? (
        <Card className="px-4 py-8 text-center text-body text-ink-muted">Loading…</Card>
      ) : usersQuery.isError ? (
        <Card className="px-4 py-8 text-center text-body text-danger">
          {usersQuery.error instanceof Error ? usersQuery.error.message : "Could not load users."}
        </Card>
      ) : (
        <UsersBody users={usersQuery.data ?? []} tab={tab} q={q} page={page} />
      )}
    </div>
  );
}

function UsersBody({
  users,
  tab,
  q,
  page,
}: {
  users: User[];
  tab: Exclude<UserRole, "superadmin">;
  q: string;
  page: number;
}) {
  const counts = {
    admin: users.filter((user) => user.role === "admin").length,
    cashier: users.filter((user) => user.role === "cashier").length,
    device: users.filter((user) => user.role === "device").length,
  };

  const inTab = users.filter((user) => user.role === tab);
  const filtered = inTab.filter((user) => matchesQuery([user.name, user.email], q));
  const { pageItems, page: safePage, pageCount, total, pageSize } = paginateItems(filtered, page);

  const tabs = USER_TABS.map((entry) => ({
    key: entry.key,
    label: entry.label,
    icon: entry.key === "admin" ? Shield : entry.key === "device" ? Smartphone : UserRound,
    count: counts[entry.key],
    href: buildHref({ tab: entry.key, q: q || undefined }),
  }));

  return (
    <>
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
    </>
  );
}
