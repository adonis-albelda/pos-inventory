import Link from "next/link";
import { Download, ListTree, Package, PackagePlus, Upload } from "lucide-react";
import { listCategories, listProducts } from "@double-a/supabase";
import { getServerClient } from "@/lib/supabase/server";
import { toCategoryOptions } from "@/lib/category-options";
import {
  buttonClass,
  ButtonLink,
  Card,
  CardHeader,
  EmptyState,
  PageHeader,
} from "@/components/ui";
import { ProductForm } from "./product-form";
import { ProductsTable } from "./products-table";

export default async function ProductsPage() {
  const supabase = await getServerClient();

  const [products, categories] = await Promise.all([
    listProducts(supabase, { includeInactive: true }),
    listCategories(supabase, { includeInactive: true }),
  ]);

  const categoryOptions = toCategoryOptions(categories);

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Package}
        title="Products"
        description="Names, prices and categories. Terminals pick these up on their next sync."
        action={
          <>
            <Link href="/products/import" className={buttonClass("secondary")}>
              <Upload size={16} strokeWidth={2} />
              Import CSV
            </Link>
            <ButtonLink href="/api/export/products" icon={Download} download>
              Export CSV
            </ButtonLink>
          </>
        }
      />

      <Card>
        <CardHeader
          icon={ListTree}
          title="All products"
          description={`${products.length} total`}
        />
        {products.length === 0 ? (
          <EmptyState
            icon={Package}
            title="No products yet"
            instruction="Add your first product to start selling."
          />
        ) : (
          <ProductsTable products={products} categories={categoryOptions} />
        )}
      </Card>

      <Card>
        <CardHeader icon={PackagePlus} title="Add a product" />
        <div className="px-4 py-5 sm:px-6">
          <ProductForm categories={categoryOptions} />
        </div>
      </Card>
    </div>
  );
}
