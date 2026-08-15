import { notFound } from "next/navigation";
import { Building2, FolderTree, Package, Receipt, Truck, Users, Warehouse } from "lucide-react";
import { companyStats } from "@double-a/supabase";
import { createServiceRoleClient } from "@double-a/supabase/service";
import { toUser } from "@double-a/supabase";
import {
  Badge,
  Card,
  CardBody,
  CardHeader,
  PageHeader,
  StatCard,
} from "@/components/ui";
import { requireSuperadmin } from "@/lib/platform";
import { CompanyControls, CompanyUsers } from "./company-detail";

export default async function CompanyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { supabase } = await requireSuperadmin();
  const stats = (await companyStats(supabase)).find((row) => row.id === id);
  if (!stats) notFound();

  const service = createServiceRoleClient();
  const { data: userRows, error } = await service
    .from("users")
    .select(
      "id, name, email, role, is_active, can_sell, must_change_password, company_id, created_at, updated_at",
    )
    .eq("company_id", id)
    .neq("role", "superadmin")
    .order("name");
  if (error) throw new Error(error.message);

  const users = (userRows ?? []).map(toUser);

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Building2}
        title={stats.name}
        description="Admins, terminals, and cashiers for this shop. Open company to use the shop dashboard."
        action={
          <Badge tone={stats.isActive ? "success" : "danger"}>
            {stats.isActive ? "Active" : "Disabled"}
          </Badge>
        }
      />

      <CompanyControls companyId={id} isActive={stats.isActive} />

      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-4">
        <StatCard icon={Package} label="Products" value={String(stats.productCount)} />
        <StatCard icon={FolderTree} label="Categories" value={String(stats.categoryCount)} />
        <StatCard icon={Truck} label="Suppliers" value={String(stats.supplierCount)} />
        <StatCard icon={Users} label="Customers" value={String(stats.customerCount)} />
        <StatCard icon={Receipt} label="Sales" value={String(stats.saleCount)} />
        <StatCard icon={Users} label="Users" value={String(stats.userCount)} />
        <StatCard icon={Warehouse} label="Stock units" value={String(stats.stockUnits)} />
      </div>

      <Card>
        <CardHeader
          title="Users"
          description="Reset Auth passwords or PINs without opening the shop dashboard. Works even when the company is disabled."
        />
        <CardBody>
          <CompanyUsers companyId={id} users={users} />
        </CardBody>
      </Card>
    </div>
  );
}
