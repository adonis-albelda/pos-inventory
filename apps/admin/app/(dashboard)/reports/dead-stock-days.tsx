"use client";

import type { Route } from "next";
import { useRouter, useSearchParams } from "next/navigation";
import { Select } from "@/components/ui";
import { DEAD_STOCK_WINDOWS } from "./dead-stock-windows";

/** Its own control, because this window is not the report date range. */
export function DeadStockDays({ days }: { days: number }) {
  const router = useRouter();
  const params = useSearchParams();

  function choose(value: string) {
    const next = new URLSearchParams(params.toString());
    next.set("days", value);
    router.push(`/reports?${next.toString()}` as Route);
  }

  return (
    <label className="flex items-center gap-2 text-caption text-ink-muted">
      Not sold in
      <Select
        className="h-8 w-28 text-caption"
        value={String(days)}
        onChange={(event) => choose(event.target.value)}
        aria-label="Dead stock window"
      >
        {DEAD_STOCK_WINDOWS.map((option) => (
          <option key={option} value={option}>
            {option} days
          </option>
        ))}
      </Select>
    </label>
  );
}
