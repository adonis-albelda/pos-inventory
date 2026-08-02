"use client";

import { useState } from "react";
import { Package } from "lucide-react";
import type { Product } from "@double-a/shared-types";
import { Card, EmptyState } from "@/components/ui";
import { Sheet } from "@/components/overlay";
import { Pagination, RecordToolbar } from "@/components/record-list";
import type { CategoryOption } from "@/lib/category-options";
import { ProductForm } from "./product-form";
import { ProductsTable } from "./products-table";

export function ProductsPanel({
  products,
  categories,
  query,
  page,
  pageCount,
  total,
  pageSize,
}: {
  products: Product[];
  categories: CategoryOption[];
  query: string;
  page: number;
  pageCount: number;
  total: number;
  pageSize: number;
}) {
  const [creating, setCreating] = useState(false);

  return (
    <>
      <Card>
        <RecordToolbar
          searchPlaceholder="Search name, SKU, barcode…"
          query={query}
          addLabel="Add product"
          onAdd={() => setCreating(true)}
          exportHref="/api/export/products"
          importHref="/products/import"
        />

        {total === 0 ? (
          <EmptyState
            icon={Package}
            title={query ? "Nothing matches that search" : "No products yet"}
            instruction={
              query
                ? "Try a different name, SKU or barcode."
                : "Add your first product to start selling."
            }
          />
        ) : (
          <ProductsTable products={products} categories={categories} />
        )}

        <Pagination
          page={page}
          pageCount={pageCount}
          total={total}
          pageSize={pageSize}
          basePath="/products"
          query={{ q: query || undefined }}
        />
      </Card>

      <Sheet
        open={creating}
        onClose={() => setCreating(false)}
        title="Add a product"
        description="Names, prices and categories. Terminals pick these up on their next sync."
        wide
      >
        <ProductForm categories={categories} onDone={() => setCreating(false)} />
      </Sheet>
    </>
  );
}
