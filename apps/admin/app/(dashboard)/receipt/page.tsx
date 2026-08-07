import { Printer, TriangleAlert } from "lucide-react";
import {
  currentAppUser,
  fetchReceiptLayout,
  fetchStoreSettings,
} from "@double-a/supabase";
import { getServerClient } from "@/lib/supabase/server";
import { Card, CardHeader, EmptyState, PageHeader } from "@/components/ui";
import { ReceiptLayoutForm } from "./receipt-layout-form";

export default async function ReceiptLayoutPage() {
  const supabase = await getServerClient();
  const user = await currentAppUser(supabase);

  if (user?.role !== "admin") {
    return (
      <div className="space-y-6">
        <PageHeader icon={Printer} title="Receipt layout" />
        <Card>
          <EmptyState
            icon={TriangleAlert}
            title="Receipt layout is for the owner's account"
            instruction="Only an admin can change what prints on the thermal receipt."
          />
        </Card>
      </div>
    );
  }

  const [layout, store] = await Promise.all([
    fetchReceiptLayout(supabase),
    fetchStoreSettings(supabase),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Printer}
        title="Receipt layout"
        description="What shows on the PT-210 (58mm). Terminals pull this on sync; each device pairs its own Bluetooth printer."
      />

      <Card>
        <CardHeader
          icon={Printer}
          title="Blocks on the receipt"
          description="Toggle sections. The preview on the right is the paper output."
        />
        <div className="px-4 py-5 sm:px-6">
          <ReceiptLayoutForm layout={layout} store={store} />
        </div>
      </Card>
    </div>
  );
}
