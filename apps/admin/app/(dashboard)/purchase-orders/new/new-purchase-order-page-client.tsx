"use client";

import { useSearchParams } from "next/navigation";
import { ClipboardList, TriangleAlert } from "lucide-react";
import { storeToday } from "@/lib/date-range";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { CreatePurchaseOrderForm } from "./create-po-form";
import { useSuppliers } from "@/lib/query/suppliers";
import { useInventoryProducts } from "@/lib/query/inventory";

export function NewPurchaseOrderPageClient() {
  const searchParams = useSearchParams();
  const supplier = searchParams.get("supplier") ?? undefined;

  // No `includeInactive` — matches the old Server Component's plain
  // listSuppliers()/listProducts() calls, which both default to active-only.
  const suppliersQuery = useSuppliers();
  const productsQuery = useInventoryProducts();

  const isPending = suppliersQuery.isPending || productsQuery.isPending;
  const error = suppliersQuery.error ?? productsQuery.error;

  if (isPending) {
    return (
      <div className="space-y-6">
        <PageHeader icon={ClipboardList} title="New purchase order" />
        <Card className="px-4 py-8 text-center text-body text-ink-muted">Loading…</Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <PageHeader icon={ClipboardList} title="New purchase order" />
        <Card className="px-4 py-8 text-center text-body text-danger">
          {error instanceof Error ? error.message : "Could not load suppliers or products."}
        </Card>
      </div>
    );
  }

  const suppliers = suppliersQuery.data ?? [];
  const products = productsQuery.data ?? [];

  // GAP: SetSupplierProductsController is write-only — no endpoint to read
  // back which products a supplier carries (see lib/query/suppliers.ts).
  // create-po-form.tsx already falls back to the full catalog when a
  // supplier has no recorded links, so an empty map here degrades cleanly —
  // same as suppliers-page-client.tsx's productIdsBySupplier.
  const supplierProductIds: Record<string, string[]> = {};

  if (suppliers.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader icon={ClipboardList} title="New purchase order" />
        <Card>
          <EmptyState
            icon={TriangleAlert}
            title="Add a supplier first"
            instruction="A purchase order needs a supplier to order from."
          />
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        icon={ClipboardList}
        title="New purchase order"
        description="Add line items and, if the supplier expects installments, a payment schedule."
      />
      <CreatePurchaseOrderForm
        suppliers={suppliers}
        products={products}
        supplierProductIds={supplierProductIds}
        defaultSupplierId={supplier}
        defaultOrderDate={storeToday()}
      />
    </div>
  );
}
