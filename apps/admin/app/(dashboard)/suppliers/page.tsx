import { Truck, TriangleAlert } from "lucide-react";
import { getCurrentUser } from "@/lib/api/session";
import { isShopAdmin } from "@/lib/authz";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { SuppliersPageClient } from "./suppliers-page-client";

/**
 * Stays a (thin) Server Component so the admin-only gate runs before any of
 * the client bundle/data below it ever mounts — same split as
 * purchase-orders/page.tsx. Everything past the gate — search, filters,
 * pagination — is client-side TanStack Query, in SuppliersPageClient.
 */
export default async function SuppliersPage() {
  const user = await getCurrentUser();

  if (!isShopAdmin(user)) {
    return (
      <div className="space-y-6">
        <PageHeader icon={Truck} title="Suppliers" />
        <Card>
          <EmptyState
            icon={TriangleAlert}
            title="Suppliers are for the owner's account"
            instruction="Only an admin can manage suppliers and purchase orders."
          />
        </Card>
      </div>
    );
  }

  return <SuppliersPageClient />;
}
