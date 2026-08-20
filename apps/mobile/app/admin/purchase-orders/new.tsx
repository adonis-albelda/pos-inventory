import { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { useMutation } from "@tanstack/react-query";
import { ArrowLeft, Plus, Trash2 } from "lucide-react-native";
import { formatMoney, roundMoney } from "@double-a/shared-types";
import { addPurchaseOrderItem, createPurchaseOrder } from "@double-a/api-client/queries";
import { getAdminApiClient } from "@/lib/api/session";
import { useSuppliers } from "@/lib/query/suppliers";
import { useInvalidatePurchaseOrders } from "@/lib/query/purchase-orders";
import { Button, Card, ErrorNote, IconButton } from "@/components/ui";
import { WaveBackdrop } from "@/components/wave-backdrop";
import { color, fontSize, radius, space, styles } from "@/theme";

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function newKey(): string {
  return Math.random().toString(36).slice(2);
}

interface ItemRow {
  key: string;
  productName: string;
  quantityOrdered: string;
  unitCost: string;
}

/**
 * Simplified vs. apps/admin's new/create-po-form.tsx: no product picker (a
 * free-text product name field is acceptable per `StorePurchaseOrderItemPayload`
 * — `productId` stays null on every line created here) and no payment-terms
 * builder (add those from the detail screen once needed). `createPurchaseOrder`
 * makes the header only; each line is a separate sequential
 * `addPurchaseOrderItem` call afterward — not atomic, same as the web version.
 */
export default function NewPurchaseOrderScreen() {
  const router = useRouter();
  const invalidate = useInvalidatePurchaseOrders();
  const suppliersQuery = useSuppliers();

  const [supplierId, setSupplierId] = useState<string | null>(null);
  const [orderDate, setOrderDate] = useState(today());
  const [expectedDate, setExpectedDate] = useState("");
  const [referenceNo, setReferenceNo] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<ItemRow[]>([
    { key: newKey(), productName: "", quantityOrdered: "1", unitCost: "" },
  ]);
  const [error, setError] = useState<string | null>(null);

  const suppliers = useMemo(() => suppliersQuery.data ?? [], [suppliersQuery.data]);

  const total = roundMoney(
    items.reduce((sum, item) => {
      const qty = Number(item.quantityOrdered) || 0;
      const cost = Number(item.unitCost) || 0;
      return sum + qty * cost;
    }, 0),
  );

  function updateItem(key: string, patch: Partial<ItemRow>) {
    setItems((previous) => previous.map((item) => (item.key === key ? { ...item, ...patch } : item)));
  }

  function addItem() {
    setItems((previous) => [
      ...previous,
      { key: newKey(), productName: "", quantityOrdered: "1", unitCost: "" },
    ]);
  }

  function removeItem(key: string) {
    setItems((previous) => (previous.length > 1 ? previous.filter((item) => item.key !== key) : previous));
  }

  const create = useMutation({
    mutationFn: async () => {
      if (!supplierId) throw new Error("Pick a supplier.");

      const cleanItems = items
        .filter((item) => item.productName.trim() && Number(item.quantityOrdered) > 0)
        .map((item) => ({
          productName: item.productName.trim(),
          quantityOrdered: Math.max(1, Math.round(Number(item.quantityOrdered) || 0)),
          unitCost: Math.max(0, roundMoney(Number(item.unitCost) || 0)),
        }));

      if (cleanItems.length === 0) throw new Error("Add at least one line item.");

      const client = getAdminApiClient();
      const order = await createPurchaseOrder(client, {
        supplierId,
        orderDate,
        expectedDate: expectedDate.trim() || null,
        referenceNo: referenceNo.trim() || null,
        notes: notes.trim() || null,
      });

      for (const item of cleanItems) {
        await addPurchaseOrderItem(client, order.id, item);
      }

      return order;
    },
    onSuccess: (order) => {
      invalidate();
      router.replace(`/admin/purchase-orders/${order.id}`);
    },
    onError: (cause) => setError(cause instanceof Error ? cause.message : "Could not create this order."),
  });

  if (suppliersQuery.isPending) {
    return (
      <View style={[styles.screen, { alignItems: "center", justifyContent: "center" }]}>
        <ActivityIndicator color={color.primary} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <WaveBackdrop />
      <ScrollView contentContainerStyle={{ padding: space.md, gap: space.md }}>
      <Pressable
        onPress={() => router.back()}
        accessibilityRole="button"
        accessibilityLabel="Back to purchase orders"
        style={{ flexDirection: "row", alignItems: "center", gap: space.xs, alignSelf: "flex-start" }}
      >
        <ArrowLeft size={18} color={color.ink} strokeWidth={2} />
        <Text style={{ fontSize: fontSize.body, color: color.ink, fontWeight: "600" }}>Purchase orders</Text>
      </Pressable>

      <Text style={{ fontSize: fontSize.headingSm, fontWeight: "700", color: color.ink }}>
        New purchase order
      </Text>

      <Card style={[{ gap: space.md }, styles.floatShadow, { borderRadius: radius.sm }]}>
        <Text style={{ fontSize: fontSize.caption, fontWeight: "600", color: color.inkMuted }}>Supplier</Text>
        {suppliers.length === 0 ? (
          <Text style={{ fontSize: fontSize.body, color: color.inkMuted }}>
            No suppliers yet — add one first.
          </Text>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={{ flexDirection: "row", gap: space.xs }}>
              {suppliers.map((supplier) => (
                <Pressable
                  key={supplier.id}
                  onPress={() => setSupplierId(supplier.id)}
                  style={{
                    paddingHorizontal: space.md,
                    paddingVertical: space.sm,
                    borderRadius: radius.sm,
                    borderWidth: 1,
                    borderColor: supplierId === supplier.id ? color.primary : color.border,
                    backgroundColor: supplierId === supplier.id ? color.primaryTint : color.surface,
                  }}
                >
                  <Text
                    style={{
                      fontSize: fontSize.caption,
                      fontWeight: "600",
                      color: supplierId === supplier.id ? color.primary : color.ink,
                    }}
                  >
                    {supplier.name}
                  </Text>
                </Pressable>
              ))}
            </View>
          </ScrollView>
        )}

        <FormField label="Order date" value={orderDate} onChangeText={setOrderDate} placeholder="YYYY-MM-DD" />
        <FormField
          label="Expected date"
          value={expectedDate}
          onChangeText={setExpectedDate}
          placeholder="YYYY-MM-DD (optional)"
        />
        <FormField
          label="Reference no."
          value={referenceNo}
          onChangeText={setReferenceNo}
          placeholder="Supplier's invoice/PO number (optional)"
        />
        <FormField label="Notes" value={notes} onChangeText={setNotes} placeholder="Optional" />
      </Card>

      <Card style={[{ gap: space.sm }, styles.floatShadow, { borderRadius: radius.sm }]}>
        <Text style={{ fontSize: fontSize.body, fontWeight: "700", color: color.ink }}>Line items</Text>
        {items.map((item) => (
          <View
            key={item.key}
            style={{
              gap: space.xs,
              paddingVertical: space.sm,
              borderBottomWidth: 1,
              borderBottomColor: color.border,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
              <TextInput
                value={item.productName}
                onChangeText={(text) => updateItem(item.key, { productName: text })}
                placeholder="Product name"
                placeholderTextColor={color.inkMuted}
                style={{
                  flex: 1,
                  minHeight: 44,
                  borderWidth: 1,
                  borderColor: color.border,
                  borderRadius: radius.sm,
                  paddingHorizontal: space.md,
                  color: color.ink,
                }}
              />
              <IconButton icon={Trash2} label="Remove line" tone="danger" onPress={() => removeItem(item.key)} />
            </View>
            <View style={{ flexDirection: "row", gap: space.sm }}>
              <TextInput
                value={item.quantityOrdered}
                onChangeText={(text) => updateItem(item.key, { quantityOrdered: text })}
                placeholder="Qty"
                keyboardType="decimal-pad"
                placeholderTextColor={color.inkMuted}
                style={{
                  flex: 1,
                  minHeight: 44,
                  borderWidth: 1,
                  borderColor: color.border,
                  borderRadius: radius.sm,
                  paddingHorizontal: space.md,
                  color: color.ink,
                }}
              />
              <TextInput
                value={item.unitCost}
                onChangeText={(text) => updateItem(item.key, { unitCost: text })}
                placeholder="Unit cost"
                keyboardType="decimal-pad"
                placeholderTextColor={color.inkMuted}
                style={{
                  flex: 1,
                  minHeight: 44,
                  borderWidth: 1,
                  borderColor: color.border,
                  borderRadius: radius.sm,
                  paddingHorizontal: space.md,
                  color: color.ink,
                }}
              />
            </View>
          </View>
        ))}
        <Button label="Add line" icon={Plus} variant="secondary" onPress={addItem} />
        <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: space.xs }}>
          <Text style={{ fontSize: fontSize.bodyLg, fontWeight: "700", color: color.ink }}>Total</Text>
          <Text style={[styles.numeric, { fontSize: fontSize.bodyLg, fontWeight: "700", color: color.ink }]}>
            {formatMoney(total)}
          </Text>
        </View>
      </Card>

      {error ? <ErrorNote>{error}</ErrorNote> : null}

      <Button
        label={create.isPending ? "Creating…" : "Create purchase order"}
        large
        busy={create.isPending}
        onPress={() => create.mutate()}
      />
      </ScrollView>
    </View>
  );
}

function FormField({
  label,
  value,
  onChangeText,
  placeholder,
}: {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
}) {
  return (
    <View style={{ gap: space.xs }}>
      <Text style={{ fontSize: fontSize.caption, fontWeight: "600", color: color.inkMuted }}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={color.inkMuted}
        style={{
          minHeight: 48,
          borderWidth: 1,
          borderColor: color.border,
          borderRadius: radius.sm,
          paddingHorizontal: space.md,
          color: color.ink,
        }}
      />
    </View>
  );
}
