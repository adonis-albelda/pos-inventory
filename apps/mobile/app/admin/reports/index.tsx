import { useMemo, useState } from "react";
import { ActivityIndicator, RefreshControl, ScrollView, Text, View } from "react-native";
import { Pressable } from "react-native";
import {
  Archive,
  Boxes,
  Package,
  Percent,
  Smartphone,
  TrendingUp,
  UserRound,
  type LucideIcon,
} from "lucide-react-native";
import { STORE_TIME_ZONE } from "@double-a/shared-types";
import { summariseProfit, type DateRange } from "@double-a/api-client/queries";
import {
  useReportByCashier,
  useReportByDevice,
  useReportDeadStock,
  useReportDiscounts,
  useReportInventoryValuation,
  useReportProfit,
  useReportTopProducts,
} from "@/lib/query/reports";
import { Badge, Card, ErrorNote, Money, SectionTitle, Stat } from "@/components/ui";
import { WaveBackdrop } from "@/components/wave-backdrop";
import { color, fontSize, radius, space, styles } from "@/theme";

/**
 * Report ranges are shop days (Asia/Manila) — same reasoning as
 * apps/admin/lib/date-range.ts. No custom calendar here: four presets cover
 * what an on-floor check needs, and "custom" isn't worth a native date
 * picker for this screen.
 */
const STORE_OFFSET = "+08:00";

const RANGE_PRESETS = ["today", "7d", "month", "last-month"] as const;
type RangePreset = (typeof RANGE_PRESETS)[number];

const PRESET_LABELS: Record<RangePreset, string> = {
  today: "Today",
  "7d": "7 days",
  month: "This month",
  "last-month": "Last month",
};

function storeToday(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: STORE_TIME_ZONE });
}

function shiftDays(day: string, days: number): string {
  const [year = 1970, month = 1, date = 1] = day.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, date + days)).toISOString().slice(0, 10);
}

function firstOfMonth(day: string): string {
  return `${day.slice(0, 7)}-01`;
}

function startOfStoreDay(day: string): string {
  return new Date(`${day}T00:00:00${STORE_OFFSET}`).toISOString();
}

function endOfStoreDay(day: string): string {
  return startOfStoreDay(shiftDays(day, 1));
}

function formatStoreDay(day: string): string {
  return new Date(`${day}T00:00:00${STORE_OFFSET}`).toLocaleDateString("en-PH", {
    dateStyle: "medium",
    timeZone: STORE_TIME_ZONE,
  });
}

interface ResolvedRange {
  range: DateRange;
  label: string;
}

function resolveRange(preset: RangePreset): ResolvedRange {
  const today = storeToday();
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
  }

  return {
    range: { from: startOfStoreDay(fromDay), to: endOfStoreDay(toDay) },
    label: fromDay === toDay ? formatStoreDay(fromDay) : `${formatStoreDay(fromDay)} – ${formatStoreDay(toDay)}`,
  };
}

function relativeTime(iso: string | null): string {
  if (!iso) return "Never";
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(diffMs / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

/** Section chrome shared by the compact-treatment reports. */
function Section({
  icon,
  title,
  hint,
  action,
  isPending,
  isError,
  error,
  isEmpty,
  emptyLabel,
  children,
}: {
  icon: LucideIcon;
  title: string;
  hint?: string;
  action?: React.ReactNode;
  isPending: boolean;
  isError: boolean;
  error: unknown;
  isEmpty: boolean;
  emptyLabel: string;
  children: React.ReactNode;
}) {
  return (
    <Card style={[{ gap: space.md }, styles.floatShadow, { borderRadius: radius.sm }]}>
      <SectionTitle icon={icon} title={title} hint={hint} action={action} />
      {isPending ? (
        <ActivityIndicator color={color.primary} />
      ) : isError ? (
        <ErrorNote>{error instanceof Error ? error.message : "Could not load this report."}</ErrorNote>
      ) : isEmpty ? (
        <Text style={styles.muted}>{emptyLabel}</Text>
      ) : (
        children
      )}
    </Card>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: space.sm,
        paddingVertical: space.sm,
        borderBottomWidth: 1,
        borderBottomColor: color.border,
      }}
    >
      {children}
    </View>
  );
}

export default function AdminReportsScreen() {
  const [preset, setPreset] = useState<RangePreset>("today");
  const [deadStockDays, setDeadStockDays] = useState(60);
  const resolved = useMemo(() => resolveRange(preset), [preset]);
  const { range, label: rangeLabel } = resolved;

  const profitQuery = useReportProfit(range);
  const topProductsQuery = useReportTopProducts(range, 15);
  const byCashierQuery = useReportByCashier(range);
  const discountsQuery = useReportDiscounts(range);
  const byDeviceQuery = useReportByDevice(range);
  const inventoryValuationQuery = useReportInventoryValuation();
  const deadStockQuery = useReportDeadStock(deadStockDays);

  const refreshing =
    profitQuery.isRefetching ||
    topProductsQuery.isRefetching ||
    byCashierQuery.isRefetching ||
    discountsQuery.isRefetching ||
    byDeviceQuery.isRefetching ||
    inventoryValuationQuery.isRefetching ||
    deadStockQuery.isRefetching;

  const onRefresh = () => {
    profitQuery.refetch();
    topProductsQuery.refetch();
    byCashierQuery.refetch();
    discountsQuery.refetch();
    byDeviceQuery.refetch();
    inventoryValuationQuery.refetch();
    deadStockQuery.refetch();
  };

  const summary = useMemo(() => summariseProfit(profitQuery.data ?? []), [profitQuery.data]);

  const inventoryTotals = useMemo(() => {
    const rows = inventoryValuationQuery.data ?? [];
    return rows.reduce(
      (acc, row) => ({
        costValue: acc.costValue + Number(row.cost_value),
        retailValue: acc.retailValue + Number(row.retail_value),
        potentialProfit: acc.potentialProfit + Number(row.potential_profit),
      }),
      { costValue: 0, retailValue: 0, potentialProfit: 0 },
    );
  }, [inventoryValuationQuery.data]);

  const topInventoryByValue = useMemo(
    () => [...(inventoryValuationQuery.data ?? [])].sort((a, b) => b.cost_value - a.cost_value).slice(0, 15),
    [inventoryValuationQuery.data],
  );

  return (
    <View style={{ flex: 1 }}>
      <WaveBackdrop />
      <ScrollView
        contentContainerStyle={{ padding: space.md, gap: space.md, paddingBottom: space["2xl"] }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
      {/* Date range presets — everything below except inventory valuation reads this. */}
      <View style={{ flexDirection: "row", gap: space.xs, flexWrap: "wrap" }}>
        {RANGE_PRESETS.map((value) => {
          const active = value === preset;
          return (
            <Pressable
              key={value}
              onPress={() => setPreset(value)}
              style={{
                paddingHorizontal: space.md,
                paddingVertical: space.xs,
                borderRadius: radius.sm,
                borderWidth: 1,
                borderColor: active ? color.primary : color.border,
                backgroundColor: active ? color.primaryTint : color.surface,
              }}
            >
              <Text
                style={{
                  fontSize: fontSize.caption,
                  fontWeight: "600",
                  color: active ? color.primary : color.inkMuted,
                }}
              >
                {PRESET_LABELS[value]}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Profit summary — full treatment. */}
      <Card style={[{ gap: space.md }, styles.floatShadow, { borderRadius: radius.sm }]}>
        <SectionTitle icon={TrendingUp} title="Profit summary" hint={rangeLabel} />
        {profitQuery.isPending ? (
          <ActivityIndicator color={color.primary} />
        ) : profitQuery.isError ? (
          <ErrorNote>
            {profitQuery.error instanceof Error ? profitQuery.error.message : "Could not load profit."}
          </ErrorNote>
        ) : (
          <View style={{ gap: space.sm }}>
            <View style={{ flexDirection: "row", gap: space.sm }}>
              <Stat icon={TrendingUp} label="Revenue" value={`₱${summary.revenue.toFixed(0)}`} tone="primary" />
              <Stat icon={TrendingUp} label="Gross profit" value={`₱${summary.grossProfit.toFixed(0)}`} tone="accent" />
              <Stat icon={Percent} label="Margin" value={`${summary.marginPercent}%`} />
            </View>
            <View style={{ flexDirection: "row", gap: space.sm }}>
              <Stat icon={Boxes} label="Sales" value={String(summary.salesCount)} />
              <Stat icon={Package} label="Items sold" value={String(summary.itemsSold)} />
              <Stat icon={Percent} label="Discounts given" value={`₱${summary.discount.toFixed(0)}`} />
            </View>
          </View>
        )}
      </Card>

      {/* Top products — full treatment. */}
      <Card style={[{ gap: space.sm }, styles.floatShadow, { borderRadius: radius.sm }]}>
        <SectionTitle icon={Package} title="Top products" hint={rangeLabel} />
        {topProductsQuery.isPending ? (
          <ActivityIndicator color={color.primary} />
        ) : topProductsQuery.isError ? (
          <ErrorNote>
            {topProductsQuery.error instanceof Error
              ? topProductsQuery.error.message
              : "Could not load top products."}
          </ErrorNote>
        ) : (topProductsQuery.data ?? []).length === 0 ? (
          <Text style={styles.muted}>No products sold in this range.</Text>
        ) : (
          <View>
            {(topProductsQuery.data ?? []).map((row, index) => (
              <Row key={`${row.product_id ?? row.product_name}-${index}`}>
                <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                  <Text
                    numberOfLines={1}
                    style={{ fontSize: fontSize.body, fontWeight: "600", color: color.ink }}
                  >
                    {index + 1}. {row.product_name}
                  </Text>
                  <Text style={{ fontSize: fontSize.caption, color: color.inkMuted }}>
                    {row.category ?? "Uncategorized"} · {row.quantity_sold} sold
                  </Text>
                </View>
                <View style={{ alignItems: "flex-end", gap: 2 }}>
                  <Money value={row.revenue} style={{ fontWeight: "600" }} />
                  <Text style={{ fontSize: fontSize.caption, color: color.successInk }}>
                    +₱{row.gross_profit.toFixed(0)} ({row.margin_percent.toFixed(0)}%)
                  </Text>
                </View>
              </Row>
            ))}
          </View>
        )}
      </Card>

      {/* By cashier — full treatment. */}
      <Card style={[{ gap: space.sm }, styles.floatShadow, { borderRadius: radius.sm }]}>
        <SectionTitle icon={UserRound} title="By cashier" hint={rangeLabel} />
        {byCashierQuery.isPending ? (
          <ActivityIndicator color={color.primary} />
        ) : byCashierQuery.isError ? (
          <ErrorNote>
            {byCashierQuery.error instanceof Error
              ? byCashierQuery.error.message
              : "Could not load cashier totals."}
          </ErrorNote>
        ) : (byCashierQuery.data ?? []).length === 0 ? (
          <Text style={styles.muted}>No sales in this range.</Text>
        ) : (
          <View>
            {(byCashierQuery.data ?? []).map((row, index) => (
              <Row key={`${row.user_id ?? row.cashier_name}-${index}`}>
                <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                  <Text style={{ fontSize: fontSize.body, fontWeight: "600", color: color.ink }}>
                    {row.cashier_name}
                  </Text>
                  <Text style={{ fontSize: fontSize.caption, color: color.inkMuted }}>
                    {row.sales_count} sales · avg ₱{row.average_sale.toFixed(0)}
                  </Text>
                </View>
                <View style={{ alignItems: "flex-end", gap: 2 }}>
                  <Money value={row.revenue} style={{ fontWeight: "600" }} />
                  <Text style={{ fontSize: fontSize.caption, color: color.successInk }}>
                    +₱{row.gross_profit.toFixed(0)} profit
                  </Text>
                </View>
              </Row>
            ))}
          </View>
        )}
      </Card>

      {/* Discounts given — compact treatment. */}
      <Section
        icon={Percent}
        title="Discounts given"
        hint={rangeLabel}
        isPending={discountsQuery.isPending}
        isError={discountsQuery.isError}
        error={discountsQuery.error}
        isEmpty={(discountsQuery.data ?? []).length === 0}
        emptyLabel="No counter discounts in this range."
      >
        <View>
          {(discountsQuery.data ?? []).slice(0, 25).map((row, index) => (
            <Row key={`${row.sale_id}-${index}`}>
              <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                <Text numberOfLines={1} style={{ fontSize: fontSize.caption, fontWeight: "600", color: color.ink }}>
                  {row.product_name}
                </Text>
                <Text style={{ fontSize: fontSize.caption, color: color.inkMuted }}>
                  {row.cashier_name ?? "Unknown"} · {new Date(row.sold_at).toLocaleDateString("en-PH")}
                </Text>
              </View>
              <View style={{ alignItems: "flex-end", gap: 2 }}>
                <Text style={{ fontSize: fontSize.caption, fontWeight: "600", color: color.dangerInk }}>
                  -₱{row.discount_total.toFixed(0)} ({row.discount_percent.toFixed(0)}%)
                </Text>
                {row.below_cost ? <Badge tone="warning" label="Below cost" /> : null}
              </View>
            </Row>
          ))}
          {(discountsQuery.data ?? []).length > 25 ? (
            <Text style={[styles.muted, { paddingTop: space.xs }]}>
              +{(discountsQuery.data ?? []).length - 25} more not shown
            </Text>
          ) : null}
        </View>
      </Section>

      {/* By device — compact treatment. */}
      <Section
        icon={Smartphone}
        title="By device"
        hint={rangeLabel}
        isPending={byDeviceQuery.isPending}
        isError={byDeviceQuery.isError}
        error={byDeviceQuery.error}
        isEmpty={(byDeviceQuery.data ?? []).length === 0}
        emptyLabel="No device activity in this range."
      >
        <View>
          {(byDeviceQuery.data ?? []).map((row) => (
            <Row key={row.device_id}>
              <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                <Text numberOfLines={1} style={{ fontSize: fontSize.caption, fontWeight: "600", color: color.ink }}>
                  {row.device_id}
                </Text>
                <Text style={{ fontSize: fontSize.caption, color: color.inkMuted }}>
                  {row.sales_count} sales · last {relativeTime(row.last_sale_at)}
                </Text>
              </View>
              <Money value={row.revenue} style={{ fontSize: fontSize.caption, fontWeight: "600" }} />
            </Row>
          ))}
        </View>
      </Section>

      {/* Inventory valuation — compact treatment, no date range. */}
      <Section
        icon={Boxes}
        title="Inventory valuation"
        hint="Right now"
        isPending={inventoryValuationQuery.isPending}
        isError={inventoryValuationQuery.isError}
        error={inventoryValuationQuery.error}
        isEmpty={(inventoryValuationQuery.data ?? []).length === 0}
        emptyLabel="No stocked products."
      >
        <View style={{ gap: space.md }}>
          <View style={{ flexDirection: "row", gap: space.sm }}>
            <Stat icon={Boxes} label="Cost value" value={`₱${inventoryTotals.costValue.toFixed(0)}`} />
            <Stat icon={Boxes} label="Retail value" value={`₱${inventoryTotals.retailValue.toFixed(0)}`} tone="primary" />
            <Stat icon={Boxes} label="Potential profit" value={`₱${inventoryTotals.potentialProfit.toFixed(0)}`} tone="accent" />
          </View>
          <View>
            {topInventoryByValue.map((row) => (
              <Row key={row.product_id}>
                <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                  <Text numberOfLines={1} style={{ fontSize: fontSize.caption, fontWeight: "600", color: color.ink }}>
                    {row.product_name}
                  </Text>
                  <Text style={{ fontSize: fontSize.caption, color: color.inkMuted }}>
                    {row.stock_quantity} {row.unit} on hand
                  </Text>
                </View>
                <Money value={row.cost_value} style={{ fontSize: fontSize.caption, fontWeight: "600" }} />
              </Row>
            ))}
          </View>
        </View>
      </Section>

      {/* Dead stock — compact treatment, own threshold instead of the date range. */}
      <Section
        icon={Archive}
        title="Dead stock"
        hint={`No sale in ${deadStockDays}+ days`}
        action={
          <View style={{ flexDirection: "row", gap: space.xs }}>
            {[30, 60, 90].map((days) => {
              const active = days === deadStockDays;
              return (
                <Pressable
                  key={days}
                  onPress={() => setDeadStockDays(days)}
                  style={{
                    paddingHorizontal: space.sm,
                    paddingVertical: 4,
                    borderRadius: radius.sm,
                    borderWidth: 1,
                    borderColor: active ? color.primary : color.border,
                    backgroundColor: active ? color.primaryTint : color.surface,
                  }}
                >
                  <Text
                    style={{
                      fontSize: fontSize.caption,
                      fontWeight: "600",
                      color: active ? color.primary : color.inkMuted,
                    }}
                  >
                    {days}d
                  </Text>
                </Pressable>
              );
            })}
          </View>
        }
        isPending={deadStockQuery.isPending}
        isError={deadStockQuery.isError}
        error={deadStockQuery.error}
        isEmpty={(deadStockQuery.data ?? []).length === 0}
        emptyLabel="Nothing has gone quiet — every product has sold recently."
      >
        <View>
          {(deadStockQuery.data ?? []).slice(0, 20).map((row) => (
            <Row key={row.product_id}>
              <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                <Text numberOfLines={1} style={{ fontSize: fontSize.caption, fontWeight: "600", color: color.ink }}>
                  {row.product_name}
                </Text>
                <Text style={{ fontSize: fontSize.caption, color: color.inkMuted }}>
                  {row.days_since_sale === null ? "Never sold" : `${row.days_since_sale}d since last sale`} ·{" "}
                  {row.stock_quantity} on hand
                </Text>
              </View>
              <Money value={row.cost_value} style={{ fontSize: fontSize.caption, fontWeight: "600" }} />
            </Row>
          ))}
          {(deadStockQuery.data ?? []).length > 20 ? (
            <Text style={[styles.muted, { paddingTop: space.xs }]}>
              +{(deadStockQuery.data ?? []).length - 20} more not shown
            </Text>
          ) : null}
        </View>
      </Section>
      </ScrollView>
    </View>
  );
}
