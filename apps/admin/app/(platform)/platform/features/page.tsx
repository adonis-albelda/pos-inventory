import { ToggleLeft } from "lucide-react";
import { requireSuperadmin } from "@/lib/platform";
import { PageHeader } from "@/components/ui";
import { FeaturesPageClient } from "./features-page-client";

/**
 * Thin Server Component so the superadmin-only gate runs before any of the
 * client bundle/data below it ever mounts — same split as /platform itself.
 */
export default async function FeaturesPage() {
  await requireSuperadmin();

  return (
    <div className="space-y-6">
      <PageHeader
        icon={ToggleLeft}
        title="Features"
        description="Turn a feature off for every shop, or for one shop only. Everything starts on."
      />
      <FeaturesPageClient />
    </div>
  );
}
