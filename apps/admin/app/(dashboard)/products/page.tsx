import { Package } from "lucide-react";
import { listCategories, listProductsPage } from "@double-a/supabase";
import { getServerClient } from "@/lib/supabase/server";
import { toCategoryOptions } from "@/lib/category-options";
import { DEFAULT_PAGE_SIZE, parseListQuery } from "@/lib/list-query";
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

  const [{ products: pageItems, total }, categories] = await Promise.all([
    listProductsPage(supabase, {
      q,
      page,
      pageSize: DEFAULT_PAGE_SIZE,
      includeInactive: true,
    }),
    listCategories(supabase, { includeInactive: true }),
  ]);

  const categoryOptions = toCategoryOptions(categories);
  const pageCount = Math.max(1, Math.ceil(total / DEFAULT_PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const products =
    safePage === page || total === 0
      ? pageItems
      : (
          await listProductsPage(supabase, {
            q,
            page: safePage,
            pageSize: DEFAULT_PAGE_SIZE,
            includeInactive: true,
          })
        ).products;

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Package}
        title="Products"
        description="Names, prices and categories. Terminals pick these up on their next sync."
      />

      <ProductsPanel
        products={products}
        categories={categoryOptions}
        query={q}
        page={safePage}
        pageCount={pageCount}
        total={total}
        pageSize={DEFAULT_PAGE_SIZE}
      />
    </div>
  );
}
