import { Truck, TriangleAlert } from "lucide-react";
import {
  currentAppUser,
  listAllSupplierProductIds,
  listProducts,
  listSupplierBalances,
  listSuppliers,
} from "@double-a/supabase";
import { getServerClient } from "@/lib/supabase/server";
import { isShopAdmin } from "@/lib/authz";
import { matchesQuery, paginateItems, parseListQuery } from "@/lib/list-query";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { SuppliersPanel } from "./suppliers-panel";

export default async function SuppliersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const params = await searchParams;
  const { q, page } = parseListQuery(params);
  const supabase = await getServerClient();
  const user = await currentAppUser(supabase);

  if (!isShopAdmin(user)) {
    return (
      <div className="space-y-6">
        <PageHeader icon={Truck} title="Suppliers" />
        <Card>
          <EmptyState
            icon={TriangleAlert}
            title="Suppliers are for the owner's account"
            instruction="Only an admin can manage suppliers and purchase orders."
          />
        </Card>
      </div>
    );
  }

  const [suppliers, products, balances, productIdsBySupplier] = await Promise.all([
    listSuppliers(supabase, { includeInactive: true }),
    listProducts(supabase, { includeInactive: true }),
    listSupplierBalances(supabase),
    listAllSupplierProductIds(supabase),
  ]);

  const filtered = suppliers.filter((supplier) =>
    matchesQuery(
      [supplier.name, supplier.contactPerson, supplier.phone, supplier.email],
      q,
    ),
  );
  const { pageItems, page: safePage, pageCount, total, pageSize } = paginateItems(
    filtered,
    page,
  );

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Truck}
        title="Suppliers"
        description="Who the shop buys stock from, what they carry, and what's owed on each order."
      />

      <SuppliersPanel
        suppliers={pageItems}
        balances={balances}
        productIdsBySupplier={productIdsBySupplier}
        products={products}
        query={q}
        page={safePage}
        pageCount={pageCount}
        total={total}
        pageSize={pageSize}
      />
    </div>
  );
}
