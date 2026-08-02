import { STORE_TIME_ZONE } from "@double-a/shared-types";
import type { DateRange } from "@double-a/supabase";

/**
 * Report days are shop days. The database buckets on STORE_TIME_ZONE
 * (public.store_timezone()), so the dashboard has to hand it boundaries cut the
 * same way — otherwise "today" on a server running in UTC starts at 8am in the
 * shop and the numbers never tie out.
 *
 * Manila has no daylight saving, so a fixed offset is exact.
 */
const STORE_OFFSET = "+08:00";

export const RANGE_PRESETS = ["today", "7d", "month", "last-month", "custom"] as const;
export type RangePreset = (typeof RANGE_PRESETS)[number];

export const PRESET_LABELS: Record<RangePreset, string> = {
  today: "Today",
  "7d": "Last 7 days",
  month: "This month",
  "last-month": "Last month",
  custom: "Custom",
};

/** Today in the shop, as yyyy-mm-dd. */
export function storeToday(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: STORE_TIME_ZONE });
}

function shiftDays(day: string, days: number): string {
  const [year = 1970, month = 1, date = 1] = day.split("-").map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, date + days));
  return shifted.toISOString().slice(0, 10);
}

function firstOfMonth(day: string): string {
  return `${day.slice(0, 7)}-01`;
}

/** Midnight at the start of a shop day, as an instant the database understands. */
function startOfStoreDay(day: string): string {
  return new Date(`${day}T00:00:00${STORE_OFFSET}`).toISOString();
}

function isValidDay(value: string | undefined): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export interface ResolvedRange {
  preset: RangePreset;
  /** Inclusive first shop day, yyyy-mm-dd. */
  fromDay: string;
  /** Inclusive last shop day, yyyy-mm-dd. */
  toDay: string;
  /** What the report functions take: `from` inclusive, `to` exclusive. */
  range: DateRange;
  label: string;
}

export function resolveRange(params: {
  preset?: string;
  from?: string;
  to?: string;
}): ResolvedRange {
  const today = storeToday();
  const preset = (RANGE_PRESETS as readonly string[]).includes(params.preset ?? "")
    ? (params.preset as RangePreset)
    : params.from || params.to
      ? "custom"
      : "today";

  let fromDay = today;
  let toDay = today;

  if (preset === "7d") {
    fromDay = shiftDays(today, -6);
  } else if (preset === "month") {
    fromDay = firstOfMonth(today);
  } else if (preset === "last-month") {
    const lastDayOfLastMonth = shiftDays(firstOfMonth(today), -1);
    fromDay = firstOfMonth(lastDayOfLastMonth);
    toDay = lastDayOfLastMonth;
  } else if (preset === "custom") {
    fromDay = isValidDay(params.from) ? params.from : today;
    toDay = isValidDay(params.to) ? params.to : today;
  }

  // A backwards range would silently report nothing at all.
  if (fromDay > toDay) [fromDay, toDay] = [toDay, fromDay];

  return {
    preset,
    fromDay,
    toDay,
    range: {
      from: startOfStoreDay(fromDay),
      to: startOfStoreDay(shiftDays(toDay, 1)),
    },
    label: describeRange(fromDay, toDay),
  };
}

/** Today's shop day, for the dashboard. */
export function todayRange(): DateRange {
  return resolveRange({ preset: "today" }).range;
}

export function formatStoreDay(day: string): string {
  return new Date(`${day}T00:00:00${STORE_OFFSET}`).toLocaleDateString("en-PH", {
    dateStyle: "medium",
    timeZone: STORE_TIME_ZONE,
  });
}

export function describeRange(fromDay: string, toDay: string): string {
  return fromDay === toDay
    ? formatStoreDay(fromDay)
    : `${formatStoreDay(fromDay)} to ${formatStoreDay(toDay)}`;
}
