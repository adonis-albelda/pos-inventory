import { useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Text, TextInput, View } from "react-native";
import { useMutation } from "@tanstack/react-query";
import { Pencil, Trash2, Wallet } from "lucide-react-native";
import type { Expense } from "@double-a/shared-types";
import { EXPENSE_CATEGORY_MAX, EXPENSE_DESCRIPTION_MAX, EXPENSE_NOTE_MAX } from "@double-a/shared-types";
import { createExpense, deleteExpense, updateExpense } from "@double-a/api-client/queries";
import { getAdminApiClient } from "@/lib/api/session";
import { useExpenses, useInvalidateExpenses } from "@/lib/query/expenses";
import { Button, EmptyState, ErrorNote, IconButton, Money } from "@/components/ui";
import { BottomSheet } from "@/components/bottom-sheet";
import { WaveBackdrop } from "@/components/wave-backdrop";
import { color, fontSize, radius, space, styles } from "@/theme";

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function AdminExpensesScreen() {
  const expensesQuery = useExpenses();
  const invalidate = useInvalidateExpenses();

  const [editing, setEditing] = useState<Expense | "new" | null>(null);

  const sorted = useMemo(() => {
    const list = expensesQuery.data ?? [];
    return [...list].sort((a, b) => b.expenseDate.localeCompare(a.expenseDate));
  }, [expensesQuery.data]);

  const total = useMemo(() => sorted.reduce((sum, expense) => sum + expense.amount, 0), [sorted]);

  const remove = useMutation({
    mutationFn: (id: string) => deleteExpense(getAdminApiClient(), id),
    onSuccess: invalidate,
  });

  if (expensesQuery.isPending) {
    return (
      <View style={[styles.screen, { alignItems: "center", justifyContent: "center" }]}>
        <ActivityIndicator color={color.primary} />
      </View>
    );
  }

  if (expensesQuery.isError) {
    return (
      <View style={{ padding: space.md }}>
        <ErrorNote>
          {expensesQuery.error instanceof Error
            ? expensesQuery.error.message
            : "Could not load expenses."}
        </ErrorNote>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <WaveBackdrop />
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: space.sm,
          padding: space.md,
        }}
      >
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: fontSize.caption, color: color.inkMuted }}>
            {sorted.length} expense{sorted.length === 1 ? "" : "s"}
          </Text>
          <Money value={total} style={{ fontSize: fontSize.headingSm, fontWeight: "700" }} />
        </View>
        <Button label="Add" icon={Wallet} onPress={() => setEditing("new")} />
      </View>

      {sorted.length === 0 ? (
        <EmptyState
          icon={Wallet}
          title="No expenses yet"
          instruction="Log rent, utilities, wages and other outlays here."
        />
      ) : (
        <FlatList
          data={sorted}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: space.md, gap: space.xs }}
          renderItem={({ item }) => (
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
              }}
            >
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ fontSize: fontSize.body, fontWeight: "600", color: color.ink }}>
                  {item.description}
                </Text>
                <Text style={{ fontSize: fontSize.caption, color: color.inkMuted }}>
                  {item.expenseDate}
                  {item.category ? ` · ${item.category}` : ""}
                </Text>
              </View>
              <Money value={item.amount} style={{ fontSize: fontSize.body, fontWeight: "600" }} />
              <IconButton icon={Pencil} label="Edit" onPress={() => setEditing(item)} />
              <IconButton
                icon={Trash2}
                label="Delete"
                tone="danger"
                onPress={() => remove.mutate(item.id)}
              />
            </View>
          )}
        />
      )}

      <BottomSheet open={editing !== null} onClose={() => setEditing(null)}>
        {editing ? (
          <ExpenseForm
            expense={editing === "new" ? null : editing}
            onDone={() => setEditing(null)}
          />
        ) : null}
      </BottomSheet>
    </View>
  );
}

function ExpenseForm({
  expense,
  onDone,
}: {
  expense: Expense | null;
  onDone: () => void;
}) {
  const invalidate = useInvalidateExpenses();
  const [description, setDescription] = useState(expense?.description ?? "");
  const [amount, setAmount] = useState(expense ? String(expense.amount) : "");
  const [category, setCategory] = useState(expense?.category ?? "");
  const [expenseDate, setExpenseDate] = useState(expense?.expenseDate ?? today());
  const [note, setNote] = useState(expense?.note ?? "");
  const [error, setError] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: async () => {
      const trimmedDescription = description.trim();
      if (!trimmedDescription) throw new Error("Give the expense a description.");
      const value = Number(amount);
      if (!Number.isFinite(value) || value <= 0) throw new Error("Enter an amount greater than 0.");
      const trimmedDate = expenseDate.trim();
      if (!trimmedDate) throw new Error("Give the expense a date.");

      const client = getAdminApiClient();
      const payload = {
        description: trimmedDescription,
        amount: value,
        category: category.trim() || null,
        expenseDate: trimmedDate,
        note: note.trim() || null,
      };
      if (expense) {
        return updateExpense(client, expense.id, payload);
      }
      return createExpense(client, payload);
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
        {expense ? "Edit expense" : "New expense"}
      </Text>
      <TextInput
        value={description}
        onChangeText={setDescription}
        placeholder="Description — electric bill, rent, delivery fuel…"
        placeholderTextColor={color.inkMuted}
        maxLength={EXPENSE_DESCRIPTION_MAX}
        style={{
          minHeight: 48,
          borderWidth: 1,
          borderColor: color.border,
          borderRadius: radius.sm,
          paddingHorizontal: space.md,
          color: color.ink,
        }}
      />
      <TextInput
        value={amount}
        onChangeText={setAmount}
        placeholder="Amount"
        keyboardType="decimal-pad"
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
      <TextInput
        value={expenseDate}
        onChangeText={setExpenseDate}
        placeholder="YYYY-MM-DD"
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
      <TextInput
        value={category}
        onChangeText={setCategory}
        placeholder="Category (optional) — rent, wages, utilities…"
        placeholderTextColor={color.inkMuted}
        maxLength={EXPENSE_CATEGORY_MAX}
        style={{
          minHeight: 48,
          borderWidth: 1,
          borderColor: color.border,
          borderRadius: radius.sm,
          paddingHorizontal: space.md,
          color: color.ink,
        }}
      />
      <TextInput
        value={note}
        onChangeText={setNote}
        placeholder="Note (optional)"
        placeholderTextColor={color.inkMuted}
        maxLength={EXPENSE_NOTE_MAX}
        style={{
          minHeight: 48,
          borderWidth: 1,
          borderColor: color.border,
          borderRadius: radius.sm,
          paddingHorizontal: space.md,
          color: color.ink,
        }}
      />
      {error ? <ErrorNote>{error}</ErrorNote> : null}
      <Button
        label={save.isPending ? "Saving…" : "Save"}
        busy={save.isPending}
        onPress={() => save.mutate()}
      />
    </View>
  );
}
