import { Boxes } from "lucide-react";
import { listMovements, listProducts } from "@double-a/supabase";
import { getServerClient } from "@/lib/supabase/server";
import { matchesQuery, paginateItems, parseListQuery } from "@/lib/list-query";
import { PageHeader } from "@/components/ui";
import { InventoryPanel } from "./inventory-panel";

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<{ product?: string; q?: string; page?: string }>;
}) {
  const params = await searchParams;
  const { q, page } = parseListQuery(params);
  const focusedProduct = params.product;
  const supabase = await getServerClient();

  const [products, movements] = await Promise.all([
    listProducts(supabase, { includeInactive: true }),
    listMovements(supabase, { productId: focusedProduct, limit: 60 }),
  ]);

  const productNames = Object.fromEntries(
    products.map((product) => [product.id, product.name]),
  );

  const filtered = products.filter((product) =>
    matchesQuery([product.name, product.sku, product.barcode], q),
  );
  const { pageItems, page: safePage, pageCount, total, pageSize } = paginateItems(
    filtered,
    page,
  );

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Boxes}
        title="Inventory"
        description="Stock changes are recorded as movements, never edited directly. Sales from terminals appear here once they sync."
      />

      <InventoryPanel
        products={pageItems}
        allProducts={products}
        movements={movements}
        query={q}
        page={safePage}
        pageCount={pageCount}
        total={total}
        pageSize={pageSize}
        focusedProduct={focusedProduct}
        productNames={productNames}
      />
    </div>
  );
}
