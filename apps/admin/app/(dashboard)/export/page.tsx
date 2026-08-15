import { Download, TriangleAlert } from "lucide-react";
import { currentAppUser } from "@double-a/supabase";
import { getServerClient } from "@/lib/supabase/server";
import { isShopAdmin } from "@/lib/authz";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { ExportPanel } from "./export-panel";

export default async function ExportPage() {
  const supabase = await getServerClient();
  const user = await currentAppUser(supabase);

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
