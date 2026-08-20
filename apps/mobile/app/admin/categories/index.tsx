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
import { CornerDownRight, Folder, FolderPlus, Pencil, Trash2 } from "lucide-react-native";
import type { Category } from "@double-a/shared-types";
import { createCategory, deleteCategory, updateCategory } from "@double-a/api-client/queries";
import { getAdminApiClient } from "@/lib/api/session";
import { useCategories, useCategoryProductCounts, useInvalidateCategories } from "@/lib/query/categories";
import { Button, EmptyState, ErrorNote, IconButton } from "@/components/ui";
import { BottomSheet } from "@/components/bottom-sheet";
import { WaveBackdrop } from "@/components/wave-backdrop";
import { color, fontSize, radius, space, styles } from "@/theme";

interface CategoryNode extends Category {
  path: string;
  depth: number;
}

function buildTree(categories: Category[]): CategoryNode[] {
  const byParent = new Map<string | null, Category[]>();
  for (const category of categories) {
    const key = category.parentId;
    byParent.set(key, [...(byParent.get(key) ?? []), category]);
  }
  for (const list of byParent.values()) list.sort((a, b) => a.name.localeCompare(b.name));

  const out: CategoryNode[] = [];
  const walk = (parentId: string | null, depth: number, prefix: string) => {
    for (const category of byParent.get(parentId) ?? []) {
      const path = prefix ? `${prefix} / ${category.name}` : category.name;
      out.push({ ...category, path, depth });
      walk(category.id, depth + 1, path);
    }
  };
  walk(null, 0, "");
  return out;
}

export default function AdminCategoriesScreen() {
  const categoriesQuery = useCategories({ includeInactive: true });
  const countsQuery = useCategoryProductCounts({ includeInactive: true });
  const invalidate = useInvalidateCategories();

  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<CategoryNode | "new" | null>(null);

  const tree = useMemo(
    () => buildTree(categoriesQuery.data ?? []),
    [categoriesQuery.data],
  );
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return tree;
    return tree.filter(
      (c) => c.name.toLowerCase().includes(needle) || c.path.toLowerCase().includes(needle),
    );
  }, [tree, query]);

  const toggleActive = useMutation({
    mutationFn: (input: { id: string; isActive: boolean }) =>
      updateCategory(getAdminApiClient(), input.id, { isActive: input.isActive }),
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteCategory(getAdminApiClient(), id),
    onSuccess: invalidate,
  });

  if (categoriesQuery.isPending || countsQuery.isPending) {
    return (
      <View style={[styles.screen, { alignItems: "center", justifyContent: "center" }]}>
        <ActivityIndicator color={color.primary} />
      </View>
    );
  }

  if (categoriesQuery.isError) {
    return (
      <View style={{ padding: space.md }}>
        <ErrorNote>
          {categoriesQuery.error instanceof Error
            ? categoriesQuery.error.message
            : "Could not load categories."}
        </ErrorNote>
      </View>
    );
  }

  const counts = countsQuery.data ?? {};

  return (
    <View style={{ flex: 1 }}>
      <WaveBackdrop />
      <View style={{ flexDirection: "row", gap: space.sm, padding: space.md }}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search categories…"
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
        <Button label="Add" icon={FolderPlus} onPress={() => setEditing("new")} />
      </View>

      {filtered.length === 0 ? (
        <EmptyState
          icon={Folder}
          title={query ? "Nothing matches" : "No categories yet"}
          instruction={query ? "Try a different name." : "Add a top-level category to start."}
        />
      ) : (
        <FlatList
          data={filtered}
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
                opacity: item.isActive ? 1 : 0.55,
              }}
            >
              {item.depth > 0 ? (
                <CornerDownRight size={14} color={color.inkMuted} />
              ) : (
                <Folder size={14} color={color.inkMuted} />
              )}
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ fontSize: fontSize.body, fontWeight: "600", color: color.ink }}>
                  {item.name}
                </Text>
                <Text style={{ fontSize: fontSize.caption, color: color.inkMuted }}>
                  {item.path} · {counts[item.id] ?? 0} products
                </Text>
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
          )}
        />
      )}

      <BottomSheet open={editing !== null} onClose={() => setEditing(null)}>
        {editing ? (
          <CategoryForm
            category={editing === "new" ? null : editing}
            onDone={() => setEditing(null)}
          />
        ) : null}
      </BottomSheet>
    </View>
  );
}

function CategoryForm({
  category,
  onDone,
}: {
  category: CategoryNode | null;
  onDone: () => void;
}) {
  const invalidate = useInvalidateCategories();
  const [name, setName] = useState(category?.name ?? "");
  const [markupPercent, setMarkupPercent] = useState(String(category?.markupPercent ?? 0));
  const [markupApplied, setMarkupApplied] = useState(category?.markupApplied ?? false);
  const [error, setError] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: async () => {
      const trimmed = name.trim();
      if (!trimmed) throw new Error("Give the category a name.");
      const percent = Number(markupPercent) || 0;
      const client = getAdminApiClient();
      if (category) {
        return updateCategory(client, category.id, {
          name: trimmed,
          markupPercent: percent,
          markupApplied,
        });
      }
      return createCategory(client, {
        name: trimmed,
        parentId: null,
        markupPercent: percent,
        markupApplied,
      });
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
        {category ? `Edit ${category.name}` : "New category"}
      </Text>
      <TextInput
        value={name}
        onChangeText={setName}
        placeholder="Name"
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
        value={markupPercent}
        onChangeText={setMarkupPercent}
        placeholder="Markup %"
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
      <Pressable
        onPress={() => setMarkupApplied((v) => !v)}
        style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}
      >
        <Switch value={markupApplied} onValueChange={setMarkupApplied} />
        <Text style={{ color: color.ink }}>Apply markup to new products</Text>
      </Pressable>
      {error ? <ErrorNote>{error}</ErrorNote> : null}
      <Button
        label={save.isPending ? "Saving…" : "Save"}
        busy={save.isPending}
        onPress={() => save.mutate()}
      />
    </View>
  );
}
