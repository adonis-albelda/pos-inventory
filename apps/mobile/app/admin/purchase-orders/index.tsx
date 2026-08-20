import { useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { ChevronRight, ClipboardList, Plus } from "lucide-react-native";
import type { PurchaseOrderStatus } from "@double-a/shared-types";
import {
  PURCHASE_ORDER_STATUS_LABELS,
  formatMoney,
  poItemReceiveState,
  purchaseOrderBalance,
} from "@double-a/shared-types";
import { useSuppliers } from "@/lib/query/suppliers";
import { PO_STATUS_TONE, usePurchaseOrders } from "@/lib/query/purchase-orders";
import { Badge, Button, EmptyState, ErrorNote, Money } from "@/components/ui";
import { WaveBackdrop } from "@/components/wave-backdrop";
import { color, fontSize, radius, space, styles } from "@/theme";

const STATUS_TABS: { value: PurchaseOrderStatus | undefined; label: string }[] = [
  { value: undefined, label: "All" },
  { value: "draft", label: "Draft" },
  { value: "ordered", label: "Ordered" },
  { value: "partially_received", label: "Partial" },
  { value: "received", label: "Received" },
  { value: "cancelled", label: "Cancelled" },
];

export default function AdminPurchaseOrdersScreen() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<PurchaseOrderStatus | undefined>(undefined);

  const ordersQuery = usePurchaseOrders({ status });
  const suppliersQuery = useSuppliers({ includeInactive: true });

  const supplierNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const supplier of suppliersQuery.data ?? []) map.set(supplier.id, supplier.name);
    return map;
  }, [suppliersQuery.data]);

  const filtered = useMemo(() => {
    const orders = ordersQuery.data ?? [];
    const needle = query.trim().toLowerCase();
    if (!needle) return orders;
    return orders.filter((order) => {
      const supplierName = supplierNameById.get(order.supplierId);
      return [supplierName, order.referenceNo, order.notes]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(needle));
    });
  }, [ordersQuery.data, query, supplierNameById]);

  if (ordersQuery.isPending || suppliersQuery.isPending) {
    return (
      <View style={[styles.screen, { alignItems: "center", justifyContent: "center" }]}>
        <ActivityIndicator color={color.primary} />
      </View>
    );
  }

  if (ordersQuery.isError) {
    return (
      <View style={{ padding: space.md }}>
        <ErrorNote>
          {ordersQuery.error instanceof Error
            ? ordersQuery.error.message
            : "Could not load purchase orders."}
        </ErrorNote>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <WaveBackdrop />
      <View style={{ padding: space.md, gap: space.sm }}>
        <View style={{ flexDirection: "row", gap: space.sm }}>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search supplier, reference, notes…"
            placeholderTextColor={color.inkMuted}
            style={{
              flex: 1,
              minHeight: 44,
              borderWidth: 1,
              borderColor: color.border,
              borderRadius: radius.sm,
              paddingHorizontal: space.md,
              color: color.ink,
              backgroundColor: color.surface,
            }}
          />
          <Button
            label="New"
            icon={Plus}
            onPress={() => router.push("/admin/purchase-orders/new")}
          />
        </View>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={STATUS_TABS}
          keyExtractor={(tab) => tab.label}
          contentContainerStyle={{ gap: space.xs }}
          renderItem={({ item: tab }) => {
            const active = tab.value === status;
            return (
              <Pressable
                onPress={() => setStatus(tab.value)}
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
                  {tab.label}
                </Text>
              </Pressable>
            );
          }}
        />
      </View>

      {filtered.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title={query ? "Nothing matches" : "No purchase orders yet"}
          instruction={
            query
              ? "Try a different supplier or reference."
              : "Start one to record what you ordered and what's shown up."
          }
        />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: space.md, gap: space.xs, paddingTop: 0 }}
          renderItem={({ item: order }) => {
            const receivedLines = order.items.filter(
              (line) => poItemReceiveState(line) === "received",
            ).length;
            const balance = purchaseOrderBalance(order.payments);

            return (
              <Pressable
                onPress={() => router.push(`/admin/purchase-orders/${order.id}`)}
                style={({ pressed }) => ({
                  flexDirection: "row",
                  alignItems: "center",
                  gap: space.sm,
                  padding: space.md,
                  borderRadius: radius.sm,
                  borderWidth: 1,
                  borderColor: color.border,
                  backgroundColor: pressed ? color.surfacePressed : color.surface,
                })}
              >
                <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                  <Text style={{ fontSize: fontSize.body, fontWeight: "600", color: color.ink }}>
                    {supplierNameById.get(order.supplierId) ?? "Unknown supplier"}
                  </Text>
                  <Text style={{ fontSize: fontSize.caption, color: color.inkMuted }}>
                    {order.orderDate}
                    {order.referenceNo ? ` · Ref ${order.referenceNo}` : ""}
                    {order.items.length > 0 ? ` · ${receivedLines}/${order.items.length} received` : ""}
                  </Text>
                  <View style={{ flexDirection: "row", gap: space.xs, marginTop: 2, alignItems: "center" }}>
                    <Badge
                      tone={PO_STATUS_TONE[order.status]}
                      label={PURCHASE_ORDER_STATUS_LABELS[order.status]}
                    />
                    {balance > 0 ? (
                      <Text style={{ fontSize: fontSize.caption, color: color.warningInk }}>
                        Owes {formatMoney(balance)}
                      </Text>
                    ) : null}
                  </View>
                </View>
                <Money value={order.totalAmount} style={{ fontWeight: "700" }} />
                <ChevronRight size={18} color={color.inkMuted} />
              </Pressable>
            );
          }}
        />
      )}
    </View>
  );
}
