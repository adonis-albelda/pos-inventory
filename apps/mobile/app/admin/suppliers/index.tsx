import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { useMutation } from "@tanstack/react-query";
import { Pencil, Trash2, Truck, UserPlus } from "lucide-react-native";
import type { Supplier } from "@double-a/shared-types";
import {
  SUPPLIER_ADDRESS_MAX,
  SUPPLIER_CONTACT_PERSON_MAX,
  SUPPLIER_EMAIL_MAX,
  SUPPLIER_NAME_MAX,
  SUPPLIER_PHONE_MAX,
} from "@double-a/shared-types";
import { createSupplier, deleteSupplier, updateSupplier } from "@double-a/api-client/queries";
import { getAdminApiClient } from "@/lib/api/session";
import { useInvalidateSuppliers, useSupplierBalances, useSuppliers } from "@/lib/query/suppliers";
import { Badge, Button, EmptyState, ErrorNote, IconButton } from "@/components/ui";
import { BottomSheet } from "@/components/bottom-sheet";
import { WaveBackdrop } from "@/components/wave-backdrop";
import { color, fontSize, radius, space, styles } from "@/theme";

export default function AdminSuppliersScreen() {
  const suppliersQuery = useSuppliers({ includeInactive: true });
  const balancesQuery = useSupplierBalances();
  const invalidate = useInvalidateSuppliers();

  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<Supplier | "new" | null>(null);

  const filtered = useMemo(() => {
    const suppliers = suppliersQuery.data ?? [];
    const needle = query.trim().toLowerCase();
    if (!needle) return suppliers;
    return suppliers.filter(
      (s) =>
        s.name.toLowerCase().includes(needle) ||
        (s.contactPerson ?? "").toLowerCase().includes(needle) ||
        (s.phone ?? "").toLowerCase().includes(needle),
    );
  }, [suppliersQuery.data, query]);

  const toggleActive = useMutation({
    mutationFn: (input: { id: string; isActive: boolean }) =>
      updateSupplier(getAdminApiClient(), input.id, { isActive: input.isActive }),
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteSupplier(getAdminApiClient(), id),
    onSuccess: invalidate,
  });

  if (suppliersQuery.isPending) {
    return (
      <View style={[styles.screen, { alignItems: "center", justifyContent: "center" }]}>
        <ActivityIndicator color={color.primary} />
      </View>
    );
  }

  if (suppliersQuery.isError) {
    return (
      <View style={{ padding: space.md }}>
        <ErrorNote>
          {suppliersQuery.error instanceof Error
            ? suppliersQuery.error.message
            : "Could not load suppliers."}
        </ErrorNote>
      </View>
    );
  }

  const balances = balancesQuery.data ?? {};

  return (
    <View style={{ flex: 1 }}>
      <WaveBackdrop />
      <View style={{ flexDirection: "row", gap: space.sm, padding: space.md }}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search name, contact, phone…"
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
        <Button label="Add" icon={UserPlus} onPress={() => setEditing("new")} />
      </View>

      {filtered.length === 0 ? (
        <EmptyState
          icon={Truck}
          title={query ? "Nothing matches" : "No suppliers yet"}
          instruction={query ? "Try a different name or contact." : "Add a supplier to start."}
        />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: space.md, gap: space.xs }}
          renderItem={({ item }) => {
            const balance = balances[item.id] ?? 0;
            return (
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: space.sm,
                  padding: space.md,
                  borderRadius: radius.sm,
                  borderWidth: 1,
                  borderColor: color.border,
                  backgroundColor: color.surface,
                  opacity: item.isActive ? 1 : 0.55,
                }}
              >
                <View style={{ flex: 1, minWidth: 0, gap: space.xs }}>
                  <Text style={{ fontSize: fontSize.body, fontWeight: "600", color: color.ink }}>
                    {item.name}
                  </Text>
                  <Text style={{ fontSize: fontSize.caption, color: color.inkMuted }}>
                    {[item.contactPerson, item.phone].filter(Boolean).join(" · ") || "—"}
                  </Text>
                  {balance > 0 ? (
                    <Badge
                      tone="warning"
                      label={`Owes ${new Intl.NumberFormat(undefined, {
                        style: "currency",
                        currency: "PHP",
                      }).format(balance)}`}
                    />
                  ) : null}
                </View>
                <Switch
                  value={item.isActive}
                  onValueChange={(value) => toggleActive.mutate({ id: item.id, isActive: value })}
                />
                <IconButton icon={Pencil} label="Edit" onPress={() => setEditing(item)} />
                <IconButton
                  icon={Trash2}
                  label="Delete"
                  tone="danger"
                  onPress={() => remove.mutate(item.id)}
                />
              </View>
            );
          }}
        />
      )}

      <BottomSheet open={editing !== null} onClose={() => setEditing(null)}>
        {editing ? (
          <SupplierForm
            supplier={editing === "new" ? null : editing}
            onDone={() => setEditing(null)}
          />
        ) : null}
      </BottomSheet>
    </View>
  );
}

function FormInput({
  value,
  onChangeText,
  placeholder,
  maxLength,
  keyboardType,
}: {
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  maxLength?: number;
  keyboardType?: "default" | "email-address" | "phone-pad";
}) {
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      maxLength={maxLength}
      keyboardType={keyboardType}
      autoCapitalize={keyboardType === "email-address" ? "none" : "sentences"}
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
  );
}

function SupplierForm({
  supplier,
  onDone,
}: {
  supplier: Supplier | null;
  onDone: () => void;
}) {
  const invalidate = useInvalidateSuppliers();
  const [name, setName] = useState(supplier?.name ?? "");
  const [contactPerson, setContactPerson] = useState(supplier?.contactPerson ?? "");
  const [phone, setPhone] = useState(supplier?.phone ?? "");
  const [email, setEmail] = useState(supplier?.email ?? "");
  const [address, setAddress] = useState(supplier?.address ?? "");
  const [isActive, setIsActive] = useState(supplier?.isActive ?? true);
  const [error, setError] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: async () => {
      const trimmed = name.trim();
      if (!trimmed) throw new Error("Give the supplier a name.");
      const client = getAdminApiClient();
      const payload = {
        name: trimmed,
        contactPerson: contactPerson.trim() || null,
        phone: phone.trim() || null,
        email: email.trim() || null,
        address: address.trim() || null,
        isActive,
      };
      if (supplier) {
        return updateSupplier(client, supplier.id, payload);
      }
      return createSupplier(client, payload);
    },
    onSuccess: () => {
      invalidate();
      onDone();
    },
    onError: (cause) => setError(cause instanceof Error ? cause.message : "Could not save."),
  });

  return (
    <View style={{ gap: space.md }}>
      <Text style={{ fontSize: fontSize.bodyLg, fontWeight: "700", color: color.ink }}>
        {supplier ? `Edit ${supplier.name}` : "New supplier"}
      </Text>
      <FormInput
        value={name}
        onChangeText={setName}
        placeholder="Name"
        maxLength={SUPPLIER_NAME_MAX}
      />
      <FormInput
        value={contactPerson}
        onChangeText={setContactPerson}
        placeholder="Contact person"
        maxLength={SUPPLIER_CONTACT_PERSON_MAX}
      />
      <FormInput
        value={phone}
        onChangeText={setPhone}
        placeholder="Phone"
        maxLength={SUPPLIER_PHONE_MAX}
        keyboardType="phone-pad"
      />
      <FormInput
        value={email}
        onChangeText={setEmail}
        placeholder="Email"
        maxLength={SUPPLIER_EMAIL_MAX}
        keyboardType="email-address"
      />
      <FormInput
        value={address}
        onChangeText={setAddress}
        placeholder="Address"
        maxLength={SUPPLIER_ADDRESS_MAX}
      />
      {supplier ? (
        <Pressable
          onPress={() => setIsActive((v) => !v)}
          style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}
        >
          <Switch value={isActive} onValueChange={setIsActive} />
          <Text style={{ color: color.ink }}>Supplier is active</Text>
        </Pressable>
      ) : null}
      {error ? <ErrorNote>{error}</ErrorNote> : null}
      <Button
        label={save.isPending ? "Saving…" : "Save"}
        busy={save.isPending}
        onPress={() => save.mutate()}
      />
    </View>
  );
}
