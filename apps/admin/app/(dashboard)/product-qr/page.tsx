import { QrCode, TriangleAlert } from "lucide-react";
import { currentAppUser, listProducts } from "@double-a/supabase";
import { getServerClient } from "@/lib/supabase/server";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { ProductQrPanel } from "./product-qr-panel";

export default async function ProductQrPage() {
  const supabase = await getServerClient();
  const user = await currentAppUser(supabase);

  if (user?.role !== "admin") {
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

  const products = await listProducts(supabase);
  const withSku = products
    .filter((product) => product.sku?.trim())
    .map((product) => ({
      id: product.id,
      name: product.name,
      sku: product.sku!.trim(),
    }));

  return (
    <div className="space-y-6">
      <PageHeader
        icon={QrCode}
        title="Product QR codes"
        description="Print a sheet of SKU QR codes for the counter scanner. One page, A4 or Legal."
      />

      {withSku.length === 0 ? (
        <Card>
          <EmptyState
            icon={QrCode}
            title="No products with a SKU"
            instruction="Add a SKU on each product first — the QR encodes that value."
          />
        </Card>
      ) : (
        <ProductQrPanel products={withSku} />
      )}
    </div>
  );
}
