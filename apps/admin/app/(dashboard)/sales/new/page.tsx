import { Receipt, TriangleAlert } from "lucide-react";
import { getCurrentUser } from "@/lib/api/session";
import { isShopAdmin } from "@/lib/authz";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { CreateSaleForm } from "./create-sale-form";

/**
 * Stays a (thin) Server Component so the admin-only gate runs before any of
 * the client bundle/data below it ever mounts — same split as
 * purchase-orders/new/page.tsx. A sale rung up here is office-only: an
 * admin taking a phone order, never something a POS terminal does — the
 * mobile POS still only ever creates a sale through its own offline cart
 * and sync push (CLAUDE.md §3).
 */
export default async function NewSalePage() {
  const user = await getCurrentUser();

  if (!isShopAdmin(user)) {
    return (
      <div className="space-y-6">
        <PageHeader icon={Receipt} title="New sale" />
        <Card>
          <EmptyState
            icon={TriangleAlert}
            title="Sales are created by the owner's account here"
            instruction="Only an admin can ring up a sale from the dashboard."
          />
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Receipt}
        title="New sale"
        description="A sale rung up directly in the office — e.g. a phone order — not from a POS terminal."
      />
      <CreateSaleForm />
    </div>
  );
}
