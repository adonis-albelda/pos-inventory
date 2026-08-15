import type { Route } from "next";
import Link from "next/link";
import { Building2, Plus } from "lucide-react";
import { companyStats } from "@double-a/supabase";
import { Badge, ButtonLink, Card, CardBody, EmptyState, PageHeader } from "@/components/ui";
import { getServerClient } from "@/lib/supabase/server";
import { requireSuperadmin } from "@/lib/platform";

export default async function PlatformPage() {
  const { supabase } = await requireSuperadmin();
  const stats = await companyStats(supabase);

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Building2}
        title="Companies"
        description="Create a shop, assign admins, and disable an account to block its API."
        action={
          <ButtonLink href={"/platform/companies/new" as Route} icon={Plus}>
            New company
          </ButtonLink>
        }
      />

      {stats.length === 0 ? (
        <EmptyState
          title="No companies yet"
          instruction="Create the first company and its admin login."
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {stats.map((company) => (
            <Link key={company.id} href={`/platform/companies/${company.id}` as Route}>
              <Card className="h-full transition-colors hover:border-primary/40">
                <CardBody className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="text-heading-sm font-semibold">{company.name}</h2>
                    <Badge tone={company.isActive ? "success" : "danger"}>
                      {company.isActive ? "Active" : "Disabled"}
                    </Badge>
                  </div>
                  <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-caption text-ink-muted">
                    <div>
                      Products <span className="font-mono text-ink">{company.productCount}</span>
                    </div>
                    <div>
                      Categories <span className="font-mono text-ink">{company.categoryCount}</span>
                    </div>
                    <div>
                      Suppliers <span className="font-mono text-ink">{company.supplierCount}</span>
                    </div>
                    <div>
                      Customers <span className="font-mono text-ink">{company.customerCount}</span>
                    </div>
                    <div>
                      Sales <span className="font-mono text-ink">{company.saleCount}</span>
                    </div>
                    <div>
                      Users <span className="font-mono text-ink">{company.userCount}</span>
                    </div>
                    <div className="col-span-2">
                      Stock units{" "}
                      <span className="font-mono text-ink">{company.stockUnits}</span>
                    </div>
                  </dl>
                </CardBody>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
