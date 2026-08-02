import {
  Boxes,
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
import { stockLevel } from "@double-a/shared-types";
import { listMovements, listProducts } from "@double-a/supabase";
import { getServerClient } from "@/lib/supabase/server";
import {
  Badge,
  Card,
  CardHeader,
  EmptyState,
  PageHeader,
  Table,
  Td,
  Th,
} from "@/components/ui";
import { StockForm } from "./stock-form";

const REASON_LABELS: Record<string, string> = {
  sale: "Sale",
  restock: "Restock",
  adjustment: "Adjustment",
  oversell_correction: "Oversell correction",
  void_restore: "Sale voided",
};

/** Each reason reads at a glance in a long history, without parsing the label. */
const REASON_ICONS: Record<string, LucideIcon> = {
  sale: ShoppingCart,
  restock: PackagePlus,
  adjustment: SlidersHorizontal,
  oversell_correction: PackageCheck,
  void_restore: RotateCcw,
};

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<{ product?: string }>;
}) {
  const { product: focusedProduct } = await searchParams;
  const supabase = await getServerClient();

  const [products, movements] = await Promise.all([
    listProducts(supabase, { includeInactive: true }),
    listMovements(supabase, { productId: focusedProduct, limit: 60 }),
  ]);

  const productNames = new Map(products.map((product) => [product.id, product.name]));

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Boxes}
        title="Inventory"
        description="Stock changes are recorded as movements, never edited directly. Sales from terminals appear here once they sync."
      />

      <Card>
        <CardHeader
          icon={ClipboardList}
          title="Restock or adjust"
          description="Every entry writes a movement row, so stock always equals the sum of its history."
        />
        <div className="px-4 py-5 sm:px-6">
          <StockForm products={products} defaultProductId={focusedProduct} />
        </div>
      </Card>

      <Card>
        <CardHeader
          icon={Warehouse}
          title="Stock on hand"
          description={`${products.length} products`}
        />
        {products.length === 0 ? (
          <EmptyState
            icon={Warehouse}
            title="No products yet"
            instruction="Add a product first, then record its opening stock here."
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
                // Same threshold the reorder report uses, so the two never
                // disagree about what "low" means for this product.
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
      </Card>

      <Card>
        <CardHeader
          icon={History}
          title="Movement history"
          description={
            focusedProduct
              ? `Filtered to ${productNames.get(focusedProduct) ?? "one product"}.`
              : "Every stock change, newest first."
          }
        />
        {movements.length === 0 ? (
          <EmptyState
            icon={History}
            title="No movements yet"
            instruction="Record a restock above, or wait for a terminal to sync its sales."
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
                      {productNames.get(movement.productId) ?? "—"}
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
    </div>
  );
}
