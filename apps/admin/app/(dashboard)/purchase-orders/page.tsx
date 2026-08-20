import { ClipboardList, TriangleAlert } from "lucide-react";
import { getCurrentUser } from "@/lib/api/session";
import { isShopAdmin } from "@/lib/authz";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { PurchaseOrdersPageClient } from "./purchase-orders-page-client";

/**
 * Stays a (thin) Server Component so the admin-only gate runs before any of
 * the client bundle/data below it ever mounts — there is no client-side
 * useCurrentUser()/isShopAdmin() equivalent yet, unlike categories (which has
 * no such gate). Everything past the gate — search, filters, pagination — is
 * client-side TanStack Query, in PurchaseOrdersPageClient.
 */
export default async function PurchaseOrdersPage() {
  const user = await getCurrentUser();

  if (!isShopAdmin(user)) {
    return (
      <div className="space-y-6">
        <PageHeader icon={ClipboardList} title="Purchase orders" />
        <Card>
          <EmptyState
            icon={TriangleAlert}
            title="Purchase orders are for the owner's account"
            instruction="Only an admin can manage suppliers and purchase orders."
          />
        </Card>
      </div>
    );
  }

  return <PurchaseOrdersPageClient />;
}
