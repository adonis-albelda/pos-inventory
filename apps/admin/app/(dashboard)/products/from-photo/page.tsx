import Link from "next/link";
import { ArrowLeft, Camera } from "lucide-react";
import { listCategories } from "@double-a/api-client/queries";
import { PageHeader } from "@/components/ui";
import { toCategoryOptions } from "@/lib/category-options";
import { getAuthedClient } from "@/lib/api/session";
import { FromPhotoPanel } from "./from-photo-panel";

export default async function FromPhotoPage() {
  const client = getAuthedClient();
  const categories = await listCategories(client, { includeInactive: true });

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Camera}
        title="From photo"
        description="Snap a notebook list — one product per line — then check and save each row."
      />

      <Link
        href="/products"
        className="inline-flex items-center gap-1 text-body font-medium text-primary hover:underline"
      >
        <ArrowLeft size={14} />
        Back to products
      </Link>

      <FromPhotoPanel categories={toCategoryOptions(categories)} />
    </div>
  );
}
