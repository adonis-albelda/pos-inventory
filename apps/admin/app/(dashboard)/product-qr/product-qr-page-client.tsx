"use client";

import { useMemo } from "react";
import { QrCode } from "lucide-react";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { ProductQrPanel } from "./product-qr-panel";
import { useInventoryProducts } from "@/lib/query/inventory";

export function ProductQrPageClient() {
  const productsQuery = useInventoryProducts();

  const withSku = useMemo(
    () =>
      (productsQuery.data ?? [])
        .filter((product) => product.sku?.trim())
        .map((product) => ({
          id: product.id,
          sku: product.sku!.trim(),
          name: product.name,
          category: product.category,
          categoryId: product.categoryId,
        })),
    [productsQuery.data],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        icon={QrCode}
        title="Product QR codes"
        description="Print a sheet of SKU QR codes for the counter scanner. One page, A4 or Legal."
      />

      {productsQuery.isPending ? (
        <Card className="px-4 py-8 text-center text-body text-ink-muted">Loading…</Card>
      ) : productsQuery.isError ? (
        <Card className="px-4 py-8 text-center text-body text-danger">
          {productsQuery.error instanceof Error
            ? productsQuery.error.message
            : "Could not load products."}
        </Card>
      ) : withSku.length === 0 ? (
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
