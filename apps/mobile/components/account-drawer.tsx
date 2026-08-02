import { Modal, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { LogOut, Shield, UserRound, X } from "lucide-react-native";
import { useSession } from "@/lib/session";
import { useStoreSettings } from "@/lib/store";
import { Button } from "@/components/ui";
import { color, fontSize, radius, space, styles } from "@/theme";

/**
 * Account panel opened from the store logo. Shift identity + end-shift live
 * here so the top chrome stays one line.
 */
export function AccountDrawer({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { cashier, lock } = useSession();
  const store = useStoreSettings();

  if (!cashier) return null;

  function endShift() {
    lock();
    onClose();
    router.replace("/unlock");
  }

  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, flexDirection: "row" }}>
        <View
          style={{
            width: "82%",
            maxWidth: 360,
            backgroundColor: color.surface,
            paddingTop: insets.top + space.md,
            paddingBottom: insets.bottom + space.lg,
            paddingHorizontal: space.lg,
            gap: space.lg,
            borderRightWidth: 1,
            borderRightColor: color.border,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              gap: space.md,
            }}
          >
            <Text
              numberOfLines={1}
              style={{ flex: 1, fontSize: fontSize.headingSm, fontWeight: "700", color: color.ink }}
            >
              {store.name}
            </Text>
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Close"
              style={styles.tapTarget}
            >
              <X size={22} color={color.inkMuted} strokeWidth={2} />
            </Pressable>
          </View>

          <View style={[styles.ledgerLine, { marginVertical: space.xs }]} />

          <View style={{ gap: space.md }}>
            <Text style={{ fontSize: fontSize.caption, fontWeight: "600", color: color.inkMuted }}>
              On shift
            </Text>

            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: space.md,
                padding: space.md,
                borderRadius: radius.md,
                backgroundColor: color.primaryTint,
                borderWidth: 1,
                borderColor: color.primarySoft,
              }}
            >
              <View
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: 26,
                  backgroundColor: color.primary,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text
                  style={{
                    fontSize: fontSize.headingSm,
                    fontWeight: "700",
                    color: color.onPrimary,
                  }}
                >
                  {cashier.name.slice(0, 1).toUpperCase()}
                </Text>
              </View>

              <View style={{ flex: 1, minWidth: 0, gap: space.xs }}>
                <Text
                  numberOfLines={1}
                  style={{ fontSize: fontSize.bodyLg, fontWeight: "700", color: color.ink }}
                >
                  {cashier.name}
                </Text>
                <View style={{ flexDirection: "row", alignItems: "center", gap: space.xs }}>
                  {cashier.role === "admin" ? (
                    <Shield size={14} color={color.primary} strokeWidth={2} />
                  ) : (
                    <UserRound size={14} color={color.primary} strokeWidth={2} />
                  )}
                  <Text style={{ fontSize: fontSize.caption, color: color.inkMuted }}>
                    {cashier.role === "admin" ? "Admin" : "Cashier"}
                  </Text>
                </View>
                {cashier.email ? (
                  <Text numberOfLines={1} style={{ fontSize: fontSize.caption, color: color.inkMuted }}>
                    {cashier.email}
                  </Text>
                ) : null}
              </View>
            </View>
          </View>

          <View style={{ flex: 1 }} />

          <Button
            label="End shift"
            variant="secondary"
            icon={LogOut}
            large
            onPress={endShift}
          />
        </View>

        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Dismiss"
          style={{ flex: 1, backgroundColor: "rgba(27, 31, 29, 0.35)" }}
        />
      </View>
    </Modal>
  );
}
