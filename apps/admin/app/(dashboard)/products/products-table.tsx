"use client";

import { useState, useTransition } from "react";
import { Eye, EyeOff, Pencil } from "lucide-react";
import type { Product } from "@double-a/shared-types";
import { formatPercent, marginPercent, stockLevel } from "@double-a/shared-types";
import { Badge, IconButton, Money, Table, Td, Th } from "@/components/ui";
import { ConfirmDialog, Sheet } from "@/components/overlay";
import type { CategoryOption } from "@/lib/category-options";
import { toggleProductActive } from "./actions";
import { ProductForm } from "./product-form";

export function ProductsTable({
  products,
  categories,
}: {
  products: Product[];
  categories: CategoryOption[];
}) {
  const [editing, setEditing] = useState<Product | null>(null);
  const [hiding, setHiding] = useState<Product | null>(null);
  const [pending, startTransition] = useTransition();

  function confirmHide() {
    if (!hiding) return;
    const form = new FormData();
    form.set("id", hiding.id);
    form.set("is_active", String(!hiding.isActive));
    startTransition(async () => {
      await toggleProductActive(form);
      setHiding(null);
    });
  }

  return (
    <>
      <Table>
        <thead>
          <tr>
            <Th>Product</Th>
            <Th>SKU</Th>
            <Th>Category</Th>
            <Th>Sold by</Th>
            <Th numeric>Supplier price</Th>
            <Th numeric>Shelf price</Th>
            <Th numeric>Margin</Th>
            <Th numeric>Stock</Th>
            <Th>State</Th>
            <Th />
          </tr>
        </thead>
        <tbody>
          {products.map((product) => {
            const level = stockLevel(product.stockQuantity, product.reorderPoint);
            const margin = marginPercent(product.price, product.costPrice);

            return (
              <tr key={product.id} className={product.isActive ? "" : "opacity-60"}>
                <Td className="font-medium">{product.name}</Td>
                <Td className="num text-ink-muted">{product.sku ?? "—"}</Td>
                <Td className="text-ink-muted">{product.category ?? "—"}</Td>
                <Td className="text-ink-muted">{product.unit}</Td>
                <Td numeric className="text-ink-muted">
                  <Money value={product.costPrice} />
                </Td>
                <Td numeric>
                  <Money value={product.price} />
                  {product.bulkPrice !== null && product.bulkMinQuantity !== null ? (
                    <span className="mt-0.5 block text-caption text-ink-muted">
                      {product.bulkMinQuantity}+ at <Money value={product.bulkPrice} />
                    </span>
                  ) : null}
                </Td>
                <Td numeric className={margin < 0 ? "font-semibold text-danger" : ""}>
                  {formatPercent(margin)}
                </Td>
                <Td numeric>
                  {product.stockQuantity}
                  <span className="mt-0.5 block text-caption text-ink-muted">
                    reorder at {product.reorderPoint}
                  </span>
                </Td>
                <Td>
                  {!product.isActive ? (
                    <Badge tone="neutral">Hidden</Badge>
                  ) : level === "out" ? (
                    <Badge tone="danger">Out of stock</Badge>
                  ) : level === "low" ? (
                    <Badge tone="warning">Low stock</Badge>
                  ) : (
                    <Badge tone="success">In stock</Badge>
                  )}
                </Td>
                <Td>
                  <div className="flex justify-end gap-1">
                    <IconButton
                      icon={Pencil}
                      label="Edit product"
                      onClick={() => setEditing(product)}
                    />
                    <IconButton
                      icon={product.isActive ? EyeOff : Eye}
                      label={
                        product.isActive ? "Hide from terminals" : "Show on terminals"
                      }
                      onClick={() => setHiding(product)}
                    />
                  </div>
                </Td>
              </tr>
            );
          })}
        </tbody>
      </Table>

      <Sheet
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing ? `Edit ${editing.name}` : "Edit product"}
        description="Changes reach terminals on their next sync."
        wide
      >
        {editing ? (
          <ProductForm
            key={editing.id}
            product={editing}
            categories={categories}
            onDone={() => setEditing(null)}
          />
        ) : null}
      </Sheet>

      <ConfirmDialog
        open={hiding !== null}
        onClose={() => setHiding(null)}
        onConfirm={confirmHide}
        pending={pending}
        title={hiding?.isActive ? "Hide product?" : "Show product?"}
        description={
          hiding?.isActive
            ? `${hiding.name} will stop appearing on terminals after their next sync. Stock and sales history stay.`
            : `${hiding?.name ?? "This product"} will show on terminals again after their next sync.`
        }
        confirmLabel={hiding?.isActive ? "Hide product" : "Show product"}
      />
    </>
  );
}
