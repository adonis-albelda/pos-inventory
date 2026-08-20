"use client";

import { Settings, Store } from "lucide-react";
import { Card, CardHeader, PageHeader } from "@/components/ui";
import { StoreForm } from "./store-form";
import { useStoreSettings } from "@/lib/query/settings";

export default function SettingsPage() {
  const settingsQuery = useStoreSettings();

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
          {settingsQuery.isPending ? (
            <p className="py-8 text-center text-body text-ink-muted">Loading…</p>
          ) : settingsQuery.isError ? (
            <p className="py-8 text-center text-body text-danger">
              {settingsQuery.error instanceof Error
                ? settingsQuery.error.message
                : "Could not load settings."}
            </p>
          ) : (
            <StoreForm settings={settingsQuery.data} />
          )}
        </div>
      </Card>
    </div>
  );
}
