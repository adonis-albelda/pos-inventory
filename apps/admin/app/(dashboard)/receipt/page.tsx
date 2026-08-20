import { Printer, TriangleAlert } from "lucide-react";
import { getCurrentUser } from "@/lib/api/session";
import { isShopAdmin } from "@/lib/authz";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { ReceiptPageClient } from "./receipt-page-client";

/**
 * Stays a (thin) Server Component so the admin-only gate runs before any of
 * the client bundle/data below it ever mounts — same split as
 * suppliers/page.tsx and purchase-orders/page.tsx. Everything past the
 * gate — the layout form and its data — is client-side TanStack Query, in
 * ReceiptPageClient.
 */
export default async function ReceiptLayoutPage() {
  const user = await getCurrentUser();

  if (!isShopAdmin(user)) {
    return (
      <div className="space-y-6">
        <PageHeader icon={Printer} title="Receipt layout" />
        <Card>
          <EmptyState
            icon={TriangleAlert}
            title="Receipt layout is for the owner's account"
            instruction="Only an admin can change what prints on the thermal receipt."
          />
        </Card>
      </div>
    );
  }

  return <ReceiptPageClient />;
}
