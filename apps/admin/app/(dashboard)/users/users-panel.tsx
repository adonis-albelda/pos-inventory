"use client";

import { useState } from "react";
import { UserPlus } from "lucide-react";
import type { User } from "@double-a/shared-types";
import { Card, EmptyState } from "@/components/ui";
import { Sheet } from "@/components/overlay";
import { Pagination, RecordToolbar } from "@/components/record-list";
import { UserForm } from "./user-form";
import { UsersTable } from "./users-table";

export function UsersPanel({
  users,
  query,
  page,
  pageCount,
  total,
  pageSize,
}: {
  users: User[];
  query: string;
  page: number;
  pageCount: number;
  total: number;
  pageSize: number;
}) {
  const [creating, setCreating] = useState(false);

  return (
    <>
      <Card>
        <RecordToolbar
          searchPlaceholder="Search name or email…"
          query={query}
          addLabel="Add user"
          onAdd={() => setCreating(true)}
          exportHref="/api/export/users"
        />

        {total === 0 ? (
          <EmptyState
            icon={UserPlus}
            title={query ? "Nothing matches that search" : "No users yet"}
            instruction={
              query
                ? "Try a different name or email."
                : "Add cashiers (PIN), admins (dashboard password), or terminal logins."
            }
          />
        ) : (
          <UsersTable users={users} />
        )}

        <Pagination
          page={page}
          pageCount={pageCount}
          total={total}
          pageSize={pageSize}
          basePath="/users"
          query={{ q: query || undefined }}
        />
      </Card>

      <Sheet
        open={creating}
        onClose={() => setCreating(false)}
        title="Add user"
        description="Pick a role — the form explains what that person can do."
        wide
      >
        <UserForm onDone={() => setCreating(false)} />
      </Sheet>
    </>
  );
}
