import { Pressable, Text, View } from "react-native";
import { Check, ChevronDown, type LucideIcon } from "lucide-react-native";
import { color, fontSize, radius, space, styles } from "@/theme";
import { BottomSheet } from "./bottom-sheet";

export interface SelectFieldOption<T extends string> {
  value: T;
  label: string;
  icon?: LucideIcon;
}

/**
 * Compact trigger + bottom-sheet option list — the native-select equivalent
 * for RN. Built so two of these can sit side by side in one row (payment
 * method, fulfillment) instead of each spelling every option out as its own
 * row of buttons.
 */
export function SelectField<T extends string>({
  label,
  icon: Icon,
  value,
  options,
  open,
  onOpen,
  onClose,
  onChange,
}: {
  label: string;
  icon?: LucideIcon;
  value: T;
  options: SelectFieldOption<T>[];
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  onChange: (value: T) => void;
}) {
  const selected = options.find((option) => option.value === value);
  const TriggerIcon = selected?.icon ?? Icon;

  return (
    <>
      <Pressable
        onPress={onOpen}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${selected?.label ?? value}`}
        style={{
          flex: 1,
          minHeight: 48,
          flexDirection: "row",
          alignItems: "center",
          gap: space.xs,
          paddingHorizontal: space.sm,
          borderRadius: radius.sm,
          borderWidth: 1,
          borderColor: color.border,
          backgroundColor: color.surface,
        }}
      >
        {TriggerIcon ? (
          <TriggerIcon size={16} color={color.primary} strokeWidth={2} />
        ) : null}
        <Text
          numberOfLines={1}
          style={{
            flex: 1,
            fontSize: fontSize.body,
            fontWeight: "600",
            color: color.ink,
          }}
        >
          {selected?.label ?? value}
        </Text>
        <ChevronDown size={16} color={color.inkMuted} strokeWidth={2} />
      </Pressable>

      <BottomSheet open={open} onClose={onClose} scroll={false}>
        <Text style={styles.subheading}>{label}</Text>
        <View style={{ gap: space.xs }}>
          {options.map((option) => {
            const isSelected = option.value === value;
            const OptionIcon = option.icon;
            return (
              <Pressable
                key={option.value}
                onPress={() => {
                  onChange(option.value);
                  onClose();
                }}
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected }}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: space.sm,
                  minHeight: 48,
                  paddingHorizontal: space.md,
                  borderRadius: radius.sm,
                  backgroundColor: isSelected ? color.primaryTint : "transparent",
                }}
              >
                {OptionIcon ? (
                  <OptionIcon
                    size={17}
                    color={isSelected ? color.primary : color.inkMuted}
                    strokeWidth={2}
                  />
                ) : null}
                <Text
                  style={{
                    flex: 1,
                    fontSize: fontSize.body,
                    fontWeight: isSelected ? "700" : "500",
                    color: isSelected ? color.primaryDark : color.ink,
                  }}
                >
                  {option.label}
                </Text>
                {isSelected ? (
                  <Check size={16} color={color.primary} strokeWidth={2.5} />
                ) : null}
              </Pressable>
            );
          })}
        </View>
      </BottomSheet>
    </>
  );
}
