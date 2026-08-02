"use client";

import type { Route } from "next";
import { useRouter, useSearchParams } from "next/navigation";
import { CalendarDays, Search } from "lucide-react";
import { Button, Field, Input, Select } from "@/components/ui";
import { PRESET_LABELS, RANGE_PRESETS, type RangePreset } from "@/lib/date-range";

export function ReportFilters({
  preset,
  fromDay,
  toDay,
}: {
  preset: RangePreset;
  fromDay: string;
  toDay: string;
}) {
  const router = useRouter();
  const params = useSearchParams();

  function apply(formData: FormData) {
    const next = new URLSearchParams();
    const chosen = String(formData.get("preset") ?? "today");

    next.set("preset", chosen);
    if (chosen === "custom") {
      next.set("from", String(formData.get("from") ?? ""));
      next.set("to", String(formData.get("to") ?? ""));
    }

    // The dead stock window is set inside its own card; keep it across a
    // range change rather than snapping it back to 60 days.
    const days = params.get("days");
    if (days) next.set("days", days);

    router.push(`/reports?${next.toString()}` as Route);
  }

  return (
    <form action={apply} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Field label="Range">
          <Select name="preset" defaultValue={preset}>
            {RANGE_PRESETS.map((option) => (
              <option key={option} value={option}>
                {PRESET_LABELS[option]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="From" hint="Used when the range is Custom.">
          <Input type="date" name="from" defaultValue={fromDay} />
        </Field>
        <Field label="To" hint="Used when the range is Custom.">
          <Input type="date" name="to" defaultValue={toDay} />
        </Field>
        <div className="self-start pt-0 sm:pt-6">
          <Button type="submit" icon={Search} className="w-full sm:w-auto">
            Show
          </Button>
        </div>
      </div>

      <p className="flex items-center gap-2 text-caption text-ink-muted">
        <CalendarDays size={14} strokeWidth={2} />
        Days run midnight to midnight in the shop, not in UTC.
      </p>
    </form>
  );
}
