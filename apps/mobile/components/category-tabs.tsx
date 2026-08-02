import { useMemo, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { Check, FolderTree, LayoutGrid, X } from "lucide-react-native";
import { CATEGORY_PATH_SEPARATOR } from "@double-a/shared-types";
import type { LocalCategory } from "@/db/categories";
import { useLayout } from "@/lib/layout";
import { color, fontSize, radius, space, styles } from "@/theme";
import { IconButton } from "./ui";

/** A category id, or `null` for every product whatever it is filed under. */
export type CategoryFilter = string | null;

/**
 * The category strip above the product grid.
 *
 * Only top-level categories get a tab — a hardware catalogue nests three deep
 * and a strip of "PVC / Copper / Galvanised" tells a cashier nothing about
 * where they are. Tapping a tab shows everything underneath it, and the last
 * chip opens the full tree in a dialog for picking a specific shelf.
 */
export function CategoryTabs({
  categories,
  value,
  onChange,
  style,
}: {
  categories: LocalCategory[];
  value: CategoryFilter;
  onChange: (next: CategoryFilter) => void;
  style?: StyleProp<ViewStyle>;
}) {
  const { compact } = useLayout();
  const [browsing, setBrowsing] = useState(false);

  // Already alphabetical, parents before children, out of the database read.
  const roots = useMemo(
    () => categories.filter((category) => category.depth === 1),
    [categories],
  );

  // The office keeps no categories yet: the strip would be a single "All" tab,
  // which is not a choice. Hide it rather than take a row from the grid.
  if (roots.length === 0) return null;

  // A flat catalogue needs no dialog: every category already has a chip, and a
  // second way to the same list beside them reads as a duplicate.
  const nested = categories.length > roots.length;

  /** A deep shelf picked in the dialog still lights up the tab it lives under. */
  const selected = categories.find((category) => category.id === value) ?? null;
  const deepSelection = selected !== null && selected.depth > 1;

  return (
    <View style={style}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ gap: space.sm }}
      >
        <Chip
          label="All"
          icon={LayoutGrid}
          selected={value === null}
          onPress={() => onChange(null)}
        />

        {roots.map((root) => (
          <Chip
            key={root.id}
            label={root.name}
            count={compact ? undefined : root.productCount}
            selected={selected?.rootId === root.id}
            // A tab is the whole branch. Tapping the tab of a deep selection
            // widens back out to everything under that root.
            onPress={() => onChange(root.id)}
          />
        ))}

        {/* Last when it is there at all: the way into the full tree. Labelled
            "Browse", never "All categories" — beside the "All" chip, two chips
            opening with the same word are read as one thing twice. */}
        {nested ? (
          <Chip
            label={compact ? "Browse" : "Browse all categories"}
            icon={FolderTree}
            tone="accent"
            onPress={() => setBrowsing(true)}
          />
        ) : null}
      </ScrollView>

      {deepSelection ? (
        <Text
          numberOfLines={1}
          style={{
            marginTop: space.xs,
            fontSize: fontSize.caption,
            color: color.primary,
          }}
        >
          Showing {selected.path}
        </Text>
      ) : null}

      <CategoryDialog
        open={browsing && nested}
        categories={categories}
        value={value}
        onClose={() => setBrowsing(false)}
        onPick={(next) => {
          onChange(next);
          setBrowsing(false);
        }}
      />
    </View>
  );
}

function Chip({
  label,
  count,
  icon: Icon,
  tone = "primary",
  selected = false,
  onPress,
}: {
  label: string;
  count?: number;
  icon?: typeof LayoutGrid;
  tone?: "primary" | "accent";
  selected?: boolean;
  onPress: () => void;
}) {
  const accent = tone === "accent";
  const tint = selected ? color.onPrimary : accent ? color.accentInk : color.ink;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={({ pressed }) => ({
        minHeight: 44,
        flexDirection: "row",
        alignItems: "center",
        gap: space.xs,
        paddingHorizontal: space.md,
        borderRadius: radius.sm,
        borderWidth: 1,
        borderColor: selected
          ? color.primary
          : accent
            ? color.accent
            : color.primarySoft,
        backgroundColor: selected
          ? color.primary
          : pressed
            ? color.primarySoft
            : accent
              ? color.accentSoft
              : color.surface,
      })}
    >
      {Icon ? <Icon size={15} color={tint} strokeWidth={2.25} /> : null}
      <Text
        numberOfLines={1}
        style={{ fontSize: fontSize.body, fontWeight: "600", color: tint }}
      >
        {label}
      </Text>
      {count === undefined ? null : (
        <Text
          style={[
            styles.numeric,
            {
              fontSize: fontSize.caption,
              color: selected ? color.onPrimary : color.inkMuted,
            },
          ]}
        >
          {count}
        </Text>
      )}
    </Pressable>
  );
}

/**
 * The whole tree at once, grouped under its top-level names. Wider than the
 * strip on purpose: this is where a cashier goes to find the one shelf they
 * cannot see in a row of tabs.
 */
function CategoryDialog({
  open,
  categories,
  value,
  onClose,
  onPick,
}: {
  open: boolean;
  categories: LocalCategory[];
  value: CategoryFilter;
  onClose: () => void;
  onPick: (next: CategoryFilter) => void;
}) {
  const { compact, width } = useLayout();

  const groups = useMemo(
    () =>
      categories
        .filter((category) => category.depth === 1)
        .map((root) => ({
          root,
          // Children only: the root is the group header and its own row. They
          // arrive in tree order, so a grandchild already sits under its parent.
          children: categories.filter(
            (category) => category.rootId === root.id && category.depth > 1,
          ),
        })),
    [categories],
  );

  // Two columns of groups once there is room, so a deep catalogue is one glance
  // rather than a long scroll.
  const columns = width >= 900 ? 2 : 1;

  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose}>
      <View
        style={{
          flex: 1,
          justifyContent: compact ? "flex-end" : "center",
          alignItems: "center",
          backgroundColor: `${color.ink}99`,
        }}
      >
        <View
          style={{
            width: "100%",
            maxWidth: 860,
            maxHeight: compact ? "88%" : "82%",
            backgroundColor: color.surface,
            borderRadius: radius.lg,
            borderBottomLeftRadius: compact ? 0 : radius.lg,
            borderBottomRightRadius: compact ? 0 : radius.lg,
            padding: space.lg,
            gap: space.md,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
            <View style={[styles.iconWell, { width: 34, height: 34 }]}>
              <FolderTree size={18} color={color.primary} strokeWidth={2} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.subheading}>All categories</Text>
              <Text style={{ fontSize: fontSize.caption, color: color.inkMuted }}>
                Pick a shelf to show only what is filed under it.
              </Text>
            </View>
            <IconButton icon={X} label="Close categories" onPress={onClose} />
          </View>

          <ScrollView contentContainerStyle={{ gap: space.md, paddingBottom: space.sm }}>
            <DialogRow
              label="All products"
              selected={value === null}
              onPress={() => onPick(null)}
            />

            <View
              style={{
                flexDirection: "row",
                flexWrap: "wrap",
                gap: space.md,
              }}
            >
              {groups.map((group) => (
                <View
                  key={group.root.id}
                  style={{
                    // Percentage rather than flex so the last odd group keeps a
                    // column width instead of stretching across the dialog.
                    width: columns === 2 ? "48%" : "100%",
                    gap: space.xs,
                  }}
                >
                  <DialogRow
                    label={group.root.name}
                    count={group.root.productCount}
                    selected={value === group.root.id}
                    emphasis
                    onPress={() => onPick(group.root.id)}
                  />
                  {group.children.map((child) => (
                    <DialogRow
                      key={child.id}
                      label={child.path
                        .split(CATEGORY_PATH_SEPARATOR)
                        .slice(1)
                        .join(CATEGORY_PATH_SEPARATOR)}
                      count={child.productCount}
                      indent
                      selected={value === child.id}
                      onPress={() => onPick(child.id)}
                    />
                  ))}
                </View>
              ))}
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function DialogRow({
  label,
  count,
  selected,
  emphasis = false,
  indent = false,
  onPress,
}: {
  label: string;
  count?: number;
  selected: boolean;
  emphasis?: boolean;
  indent?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={({ pressed }) => ({
        minHeight: 48,
        flexDirection: "row",
        alignItems: "center",
        gap: space.sm,
        paddingHorizontal: space.md,
        marginLeft: indent ? space.md : 0,
        borderRadius: radius.sm,
        borderWidth: 1,
        borderColor: selected ? color.primary : color.border,
        backgroundColor: selected
          ? color.primaryTint
          : pressed
            ? color.primarySoft
            : color.surface,
      })}
    >
      <Text
        numberOfLines={1}
        style={{
          flex: 1,
          fontSize: fontSize.body,
          fontWeight: emphasis || selected ? "700" : "500",
          color: selected ? color.primaryDark : color.ink,
        }}
      >
        {label}
      </Text>
      {count === undefined ? null : (
        <Text
          style={[styles.numeric, { fontSize: fontSize.caption, color: color.inkMuted }]}
        >
          {count}
        </Text>
      )}
      {selected ? <Check size={16} color={color.primary} strokeWidth={2.5} /> : null}
    </Pressable>
  );
}
