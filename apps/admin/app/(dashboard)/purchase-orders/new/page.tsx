import { ClipboardList, TriangleAlert } from "lucide-react";
import { getCurrentUser } from "@/lib/api/session";
import { isShopAdmin } from "@/lib/authz";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { NewPurchaseOrderPageClient } from "./new-purchase-order-page-client";

/**
 * Stays a (thin) Server Component so the admin-only gate runs before any of
 * the client bundle/data below it ever mounts — same split as
 * purchase-orders/page.tsx and suppliers/page.tsx. Everything past the gate —
 * the supplier/product lookup and the builder itself — is client-side
 * TanStack Query, in NewPurchaseOrderPageClient.
 */
export default async function NewPurchaseOrderPage() {
  const user = await getCurrentUser();

  if (!isShopAdmin(user)) {
    return (
      <div className="space-y-6">
        <PageHeader icon={ClipboardList} title="New purchase order" />
        <Card>
          <EmptyState
            icon={TriangleAlert}
            title="Purchase orders are for the owner's account"
            instruction="Only an admin can create a purchase order."
          />
        </Card>
      </div>
    );
  }

  return <NewPurchaseOrderPageClient />;
}
