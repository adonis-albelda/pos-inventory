import { ClipboardList, TriangleAlert } from "lucide-react";
import {
  currentAppUser,
  listAllSupplierProductIds,
  listProducts,
  listSuppliers,
} from "@double-a/supabase";
import { getServerClient } from "@/lib/supabase/server";
import { isShopAdmin } from "@/lib/authz";
import { storeToday } from "@/lib/date-range";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { CreatePurchaseOrderForm } from "./create-po-form";

export default async function NewPurchaseOrderPage({
  searchParams,
}: {
  searchParams: Promise<{ supplier?: string }>;
}) {
  const { supplier } = await searchParams;
  const supabase = await getServerClient();
  const user = await currentAppUser(supabase);

  if (!isShopAdmin(user)) {
    return (
      <div className="space-y-6">
        <PageHeader icon={ClipboardList} title="New purchase order" />
        <Card>
          <EmptyState
            icon={TriangleAlert}
            title="Purchase orders are for the owner's account"
            instruction="Only an admin can create a purchase order."
          />
        </Card>
      </div>
    );
  }

  const [suppliers, products, supplierProductIds] = await Promise.all([
    listSuppliers(supabase),
    listProducts(supabase),
    listAllSupplierProductIds(supabase),
  ]);

  if (suppliers.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader icon={ClipboardList} title="New purchase order" />
        <Card>
          <EmptyState
            icon={TriangleAlert}
            title="Add a supplier first"
            instruction="A purchase order needs a supplier to order from."
          />
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        icon={ClipboardList}
        title="New purchase order"
        description="Add line items and, if the supplier expects installments, a payment schedule."
      />
      <CreatePurchaseOrderForm
        suppliers={suppliers}
        products={products}
        supplierProductIds={supplierProductIds}
        defaultSupplierId={supplier}
        defaultOrderDate={storeToday()}
      />
    </div>
  );
}
