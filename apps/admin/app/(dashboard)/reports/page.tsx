import { ChartColumn, TriangleAlert } from "lucide-react";
import { getCurrentUser } from "@/lib/api/session";
import { isShopAdmin } from "@/lib/authz";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { ReportsPageClient } from "./reports-page-client";

/**
 * Stays a (thin) Server Component so the admin-only gate runs before any of
 * the client bundle/data below it ever mounts — same split as
 * suppliers/page.tsx and purchase-orders/page.tsx. Supplier cost and margin
 * are the owner's business, and the database refuses these functions to
 * anyone else. Everything past the gate — range picking, the seven reports,
 * reorder list — is client-side TanStack Query, in ReportsPageClient.
 */
export default async function ReportsPage() {
  const user = await getCurrentUser();

  if (!isShopAdmin(user)) {
    return (
      <div className="space-y-6">
        <PageHeader icon={ChartColumn} title="Reports" />
        <Card>
          <EmptyState
            icon={TriangleAlert}
            title="Reports are for the owner's account"
            instruction="Profit, supplier cost and margin are only shown to an admin. Ask the owner to sign in."
          />
        </Card>
      </div>
    );
  }

  return <ReportsPageClient />;
}
