"use client";

import { useState } from "react";
import {
  ClipboardList,
  History,
  PackageCheck,
  PackagePlus,
  RotateCcw,
  ShoppingCart,
  SlidersHorizontal,
  Warehouse,
  type LucideIcon,
} from "lucide-react";
import type { InventoryMovement, Product } from "@double-a/shared-types";
import { stockLevel } from "@double-a/shared-types";
import {
  Badge,
  Card,
  CardHeader,
  EmptyState,
  Table,
  Td,
  Th,
} from "@/components/ui";
import { Sheet } from "@/components/overlay";
import { Pagination, RecordToolbar } from "@/components/record-list";
import { StockForm } from "./stock-form";

const REASON_LABELS: Record<string, string> = {
  sale: "Sale",
  restock: "Restock",
  adjustment: "Adjustment",
  oversell_correction: "Oversell correction",
  void_restore: "Sale voided",
};

const REASON_ICONS: Record<string, LucideIcon> = {
  sale: ShoppingCart,
  restock: PackagePlus,
  adjustment: SlidersHorizontal,
  oversell_correction: PackageCheck,
  void_restore: RotateCcw,
};

export function InventoryPanel({
  products,
  allProducts,
  movements,
  query,
  page,
  pageCount,
  total,
  pageSize,
  focusedProduct,
  productNames,
}: {
  products: Product[];
  allProducts: Product[];
  movements: InventoryMovement[];
  query: string;
  page: number;
  pageCount: number;
  total: number;
  pageSize: number;
  focusedProduct?: string;
  productNames: Record<string, string>;
}) {
  const [adjusting, setAdjusting] = useState(Boolean(focusedProduct));

  return (
    <>
      <Card>
        <RecordToolbar
          searchPlaceholder="Search products…"
          query={query}
          addLabel="Restock or adjust"
          onAdd={() => setAdjusting(true)}
          exportHref="/api/export/valuation"
          preserve={{
            product: focusedProduct,
          }}
        />

        {total === 0 ? (
          <EmptyState
            icon={Warehouse}
            title={query ? "Nothing matches that search" : "No products yet"}
            instruction={
              query
                ? "Try a different name or SKU."
                : "Add a product first, then record its opening stock here."
            }
          />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Product</Th>
                <Th>SKU</Th>
                <Th numeric>Stock</Th>
                <Th numeric>Reorder at</Th>
                <Th>State</Th>
              </tr>
            </thead>
            <tbody>
              {products.map((product) => {
                const level = stockLevel(product.stockQuantity, product.reorderPoint);
                const oversold = product.stockQuantity < 0;

                return (
                  <tr key={product.id}>
                    <Td className="font-medium">{product.name}</Td>
                    <Td className="num text-ink-muted">{product.sku ?? "—"}</Td>
                    <Td
                      numeric
                      className={oversold ? "font-semibold text-danger" : "font-medium"}
                    >
                      {product.stockQuantity}
                    </Td>
                    <Td numeric className="text-ink-muted">
                      {product.reorderPoint}
                    </Td>
                    <Td>
                      {oversold ? (
                        <Badge tone="danger">Oversold</Badge>
                      ) : level === "out" ? (
                        <Badge tone="danger">Out of stock</Badge>
                      ) : level === "low" ? (
                        <Badge tone="warning">Low stock</Badge>
                      ) : (
                        <Badge tone="success">In stock</Badge>
                      )}
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}

        <Pagination
          page={page}
          pageCount={pageCount}
          total={total}
          pageSize={pageSize}
          basePath="/inventory"
          query={{ q: query || undefined, product: focusedProduct }}
        />
      </Card>

      <Card>
        <CardHeader
          icon={History}
          title="Movement history"
          description={
            focusedProduct
              ? `Filtered to ${productNames[focusedProduct] ?? "one product"}.`
              : "Every stock change, newest first."
          }
        />
        {movements.length === 0 ? (
          <EmptyState
            icon={History}
            title="No movements yet"
            instruction="Record a restock, or wait for a terminal to sync its sales."
          />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>When</Th>
                <Th>Product</Th>
                <Th>Reason</Th>
                <Th numeric>Change</Th>
                <Th>Note</Th>
              </tr>
            </thead>
            <tbody>
              {movements.map((movement) => {
                const ReasonIcon = REASON_ICONS[movement.reason] ?? SlidersHorizontal;

                return (
                  <tr key={movement.id}>
                    <Td className="num whitespace-nowrap text-ink-muted">
                      {new Date(movement.createdAt).toLocaleString("en-PH", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </Td>
                    <Td className="font-medium">
                      {productNames[movement.productId] ?? "—"}
                    </Td>
                    <Td>
                      <span className="inline-flex items-center gap-2 whitespace-nowrap">
                        <ReasonIcon size={15} className="text-ink-muted" />
                        {REASON_LABELS[movement.reason] ?? movement.reason}
                      </span>
                    </Td>
                    <Td
                      numeric
                      className={
                        movement.changeQuantity < 0
                          ? "font-semibold text-danger"
                          : "font-semibold text-success"
                      }
                    >
                      {movement.changeQuantity > 0 ? "+" : ""}
                      {movement.changeQuantity}
                    </Td>
                    <Td className="text-ink-muted">{movement.note ?? "—"}</Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </Card>

      <Sheet
        open={adjusting}
        onClose={() => setAdjusting(false)}
        title="Restock or adjust"
        description="Every entry writes a movement row, so stock always equals the sum of its history."
        wide
      >
        <div className="flex items-start gap-2 text-caption text-ink-muted">
          <ClipboardList size={14} className="mt-0.5 shrink-0" />
          <span>Stock is never edited directly — only through movements.</span>
        </div>
        <div className="mt-4">
          <StockForm
            products={allProducts}
            defaultProductId={focusedProduct}
            onDone={() => setAdjusting(false)}
          />
        </div>
      </Sheet>
    </>
  );
}
