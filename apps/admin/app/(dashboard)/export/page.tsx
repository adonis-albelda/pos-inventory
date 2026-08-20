import { Download, TriangleAlert } from "lucide-react";
import { getCurrentUser } from "@/lib/api/session";
import { isShopAdmin } from "@/lib/authz";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { ExportPanel } from "./export-panel";

export default async function ExportPage() {
  const user = await getCurrentUser();

  if (!isShopAdmin(user)) {
    return (
      <div className="space-y-6">
        <PageHeader icon={Download} title="Export data" />
        <Card>
          <EmptyState
            icon={TriangleAlert}
            title="Exports are for the owner's account"
            instruction="Only an admin can download catalogue, sales and stock files."
          />
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Download}
        title="Export data"
        description="Pull a backup of the shop's records as CSV, Excel or PDF."
      />
      <ExportPanel />
    </div>
  );
}
