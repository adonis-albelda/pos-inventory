import { FolderTree } from "lucide-react";
import { countProductsByCategory, listCategories } from "@double-a/supabase";
import { getServerClient } from "@/lib/supabase/server";
import { rollupProductCounts, toCategoryOptions } from "@/lib/category-options";
import { matchesQuery, paginateItems, parseListQuery } from "@/lib/list-query";
import { PageHeader } from "@/components/ui";
import { CategoriesPanel } from "./categories-panel";

export default async function CategoriesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const params = await searchParams;
  const { q, page } = parseListQuery(params);
  const supabase = await getServerClient();

  const [categories, ownCounts] = await Promise.all([
    listCategories(supabase, { includeInactive: true }),
    countProductsByCategory(supabase, { includeInactive: true }),
  ]);

  const options = toCategoryOptions(categories);
  const productCounts = rollupProductCounts(options, ownCounts);

  const filtered = options.filter((category) =>
    matchesQuery([category.name, category.path], q),
  );
  const { pageItems, page: safePage, pageCount, total, pageSize } = paginateItems(
    filtered,
    page,
  );

  return (
    <div className="space-y-6">
      <PageHeader
        icon={FolderTree}
        title="Categories"
        description="How the shop is laid out — Plumbing / Pipes / PVC. Products carry the full path, so a rename reaches every one of them."
      />

      <CategoriesPanel
        categories={pageItems}
        allCategories={options}
        productCounts={productCounts}
        query={q}
        page={safePage}
        pageCount={pageCount}
        total={total}
        pageSize={pageSize}
      />
    </div>
  );
}
