import { Package } from "lucide-react";
import { listCategories, listProducts } from "@double-a/supabase";
import { getServerClient } from "@/lib/supabase/server";
import { toCategoryOptions } from "@/lib/category-options";
import { matchesQuery, paginateItems, parseListQuery } from "@/lib/list-query";
import { PageHeader } from "@/components/ui";
import { ProductsPanel } from "./products-panel";

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const params = await searchParams;
  const { q, page } = parseListQuery(params);
  const supabase = await getServerClient();

  const [products, categories] = await Promise.all([
    listProducts(supabase, { includeInactive: true }),
    listCategories(supabase, { includeInactive: true }),
  ]);

  const categoryOptions = toCategoryOptions(categories);
  const filtered = products.filter((product) =>
    matchesQuery([product.name, product.sku, product.barcode, product.category], q),
  );
  const { pageItems, page: safePage, pageCount, total, pageSize } = paginateItems(
    filtered,
    page,
  );

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Package}
        title="Products"
        description="Names, prices and categories. Terminals pick these up on their next sync."
      />

      <ProductsPanel
        products={pageItems}
        categories={categoryOptions}
        query={q}
        page={safePage}
        pageCount={pageCount}
        total={total}
        pageSize={pageSize}
      />
    </div>
  );
}
