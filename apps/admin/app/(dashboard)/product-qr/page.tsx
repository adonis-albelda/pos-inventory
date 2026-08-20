import { QrCode, TriangleAlert } from "lucide-react";
import { getCurrentUser } from "@/lib/api/session";
import { isShopAdmin } from "@/lib/authz";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { ProductQrPageClient } from "./product-qr-page-client";

/**
 * Stays a (thin) Server Component so the admin-only gate runs before any of
 * the client bundle/data below it ever mounts — same split as
 * suppliers/page.tsx. The product lookup is client-side TanStack Query, in
 * ProductQrPageClient.
 */
export default async function ProductQrPage() {
  const user = await getCurrentUser();

  if (!isShopAdmin(user)) {
    return (
      <div className="space-y-6">
        <PageHeader icon={QrCode} title="Product QR codes" />
        <Card>
          <EmptyState
            icon={TriangleAlert}
            title="Product QR codes are for the owner's account"
            instruction="Only an admin can generate printable SKU sheets."
          />
        </Card>
      </div>
    );
  }

  return <ProductQrPageClient />;
}
