"use client";

import { Fragment, useState } from "react";
import { Eye, EyeOff, Pencil, X } from "lucide-react";
import type { Product } from "@double-a/shared-types";
import { formatPercent, marginPercent, stockLevel } from "@double-a/shared-types";
import { Badge, IconButton, Money, Table, Td, Th } from "@/components/ui";
import type { CategoryOption } from "@/lib/category-options";
import { toggleProductActive } from "./actions";
import { ProductForm } from "./product-form";

const COLUMN_COUNT = 9;

export function ProductsTable({
  products,
  categories,
}: {
  products: Product[];
  categories: CategoryOption[];
}) {
  const [editing, setEditing] = useState<string | null>(null);

  return (
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
          // Each product decides for itself what "low" means — a box of screws
          // and a length of GI pipe run out very differently.
          const level = stockLevel(product.stockQuantity, product.reorderPoint);
          const margin = marginPercent(product.price, product.costPrice);
          const isEditing = editing === product.id;

          return (
            <Fragment key={product.id}>
              <tr className={product.isActive ? "" : "opacity-60"}>
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
                      {product.bulkMinQuantity}+ at{" "}
                      <Money value={product.bulkPrice} />
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
                      icon={isEditing ? X : Pencil}
                      label={isEditing ? "Close editor" : "Edit product"}
                      onClick={() => setEditing(isEditing ? null : product.id)}
                    />
                    <form action={toggleProductActive}>
                      <input type="hidden" name="id" value={product.id} />
                      <input
                        type="hidden"
                        name="is_active"
                        value={String(!product.isActive)}
                      />
                      <IconButton
                        icon={product.isActive ? EyeOff : Eye}
                        label={
                          product.isActive
                            ? "Hide from terminals"
                            : "Show on terminals"
                        }
                        type="submit"
                      />
                    </form>
                  </div>
                </Td>
              </tr>
              {isEditing ? (
                <tr>
                  <Td
                    colSpan={COLUMN_COUNT + 1}
                    className="border-l-2 border-l-primary bg-paper"
                  >
                    <ProductForm
                      product={product}
                      categories={categories}
                      onDone={() => setEditing(null)}
                    />
                  </Td>
                </tr>
              ) : null}
            </Fragment>
          );
        })}
      </tbody>
    </Table>
  );
}
