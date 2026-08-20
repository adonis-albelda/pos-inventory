import { TriangleAlert, Wallet } from "lucide-react";
import { getCurrentUser } from "@/lib/api/session";
import { isShopAdmin } from "@/lib/authz";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { ExpensesPageClient } from "./expenses-page-client";

/**
 * Stays a (thin) Server Component so the admin-only gate runs before any of
 * the client bundle/data below it ever mounts — same split as
 * suppliers/page.tsx. Everything past the gate — search and pagination — is
 * client-side TanStack Query, in ExpensesPageClient.
 */
export default async function ExpensesPage() {
  const user = await getCurrentUser();

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

  return <ExpensesPageClient />;
}
