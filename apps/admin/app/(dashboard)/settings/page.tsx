import { Settings, Store } from "lucide-react";
import { fetchStoreSettings } from "@double-a/supabase";
import { getServerClient } from "@/lib/supabase/server";
import { Card, CardHeader, PageHeader } from "@/components/ui";
import { StoreForm } from "./store-form";

export default async function SettingsPage() {
  const supabase = await getServerClient();
  const settings = await fetchStoreSettings(supabase);

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Settings}
        title="Settings"
        description="Who the shop is, everywhere it shows up."
      />

      <Card>
        <CardHeader
          icon={Store}
          title="Company details"
          description="Terminals show the name and logo, and pick up changes on their next sync."
        />
        <div className="px-4 py-5 sm:px-6">
          <StoreForm settings={settings} />
        </div>
      </Card>
    </div>
  );
}
