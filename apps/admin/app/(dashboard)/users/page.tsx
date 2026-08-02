import { UserPlus, Users } from "lucide-react";
import { listUsers } from "@double-a/supabase";
import { getServerClient } from "@/lib/supabase/server";
import { Card, CardHeader, EmptyState, PageHeader } from "@/components/ui";
import { UserForm } from "./user-form";
import { UsersTable } from "./users-table";

export default async function UsersPage() {
  const supabase = await getServerClient();
  const users = await listUsers(supabase, { includeInactive: true });

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Users}
        title="Cashiers"
        description="Who can ring up a sale, and on which terminals."
      />

      <Card>
        <CardHeader
          icon={Users}
          title="People and terminals"
          description={`${users.length} total`}
        />
        {users.length === 0 ? (
          <EmptyState
            icon={UserPlus}
            title="No one added yet"
            instruction="Add a cashier with a PIN so they can unlock a terminal and start selling."
          />
        ) : (
          <UsersTable users={users} />
        )}
      </Card>

      <Card>
        <CardHeader icon={UserPlus} title="Add a person" />
        <div className="px-4 py-5 sm:px-6">
          <UserForm />
        </div>
      </Card>
    </div>
  );
}
