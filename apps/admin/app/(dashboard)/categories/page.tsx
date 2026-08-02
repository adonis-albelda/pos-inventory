import { FolderPlus, FolderTree, ListTree } from "lucide-react";
import { listCategories, listProducts } from "@double-a/supabase";
import { getServerClient } from "@/lib/supabase/server";
import { toCategoryOptions } from "@/lib/category-options";
import { Card, CardHeader, EmptyState, PageHeader } from "@/components/ui";
import { CategoriesTree } from "./categories-tree";
import { CategoryForm } from "./category-form";

export default async function CategoriesPage() {
  const supabase = await getServerClient();

  const [categories, products] = await Promise.all([
    listCategories(supabase, { includeInactive: true }),
    listProducts(supabase, { includeInactive: true }),
  ]);

  const options = toCategoryOptions(categories);

  const productCounts: Record<string, number> = {};
  for (const product of products) {
    if (!product.categoryId) continue;
    productCounts[product.categoryId] = (productCounts[product.categoryId] ?? 0) + 1;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        icon={FolderTree}
        title="Categories"
        description="How the shop is laid out — Plumbing / Pipes / PVC. Products carry the full path, so a rename reaches every one of them."
      />

      <Card>
        <CardHeader
          icon={ListTree}
          title="The tree"
          description={`${options.length} ${options.length === 1 ? "category" : "categories"}, ${products.filter((product) => !product.categoryId).length} products with none`}
        />
        {options.length === 0 ? (
          <EmptyState
            icon={FolderTree}
            title="No categories yet"
            instruction="Add a top-level category like Plumbing, then nest Pipes underneath it."
          />
        ) : (
          <CategoriesTree categories={options} productCounts={productCounts} />
        )}
      </Card>

      <Card>
        <CardHeader icon={FolderPlus} title="Add a category" />
        <div className="px-4 py-5 sm:px-6">
          <CategoryForm categories={options} />
        </div>
      </Card>
    </div>
  );
}
