"use client";

import { Printer } from "lucide-react";
import { Card, CardHeader, PageHeader } from "@/components/ui";
import { ReceiptLayoutForm } from "./receipt-layout-form";
import { useReceiptLayout, useStoreSettings } from "@/lib/query/settings";

export function ReceiptPageClient() {
  const layoutQuery = useReceiptLayout();
  const storeQuery = useStoreSettings();

  const isPending = layoutQuery.isPending || storeQuery.isPending;
  const error = layoutQuery.error ?? storeQuery.error;

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
          {isPending ? (
            <p className="py-8 text-center text-body text-ink-muted">Loading…</p>
          ) : error ? (
            <p className="py-8 text-center text-body text-danger">
              {error instanceof Error ? error.message : "Could not load the receipt layout."}
            </p>
          ) : (
            <ReceiptLayoutForm layout={layoutQuery.data!} store={storeQuery.data!} />
          )}
        </div>
      </Card>
    </div>
  );
}
