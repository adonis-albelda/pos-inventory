import { Redirect, Stack, usePathname, useRouter } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CloudUpload, LogOut, Receipt, Settings, ShoppingCart, Truck } from "lucide-react-native";
import { useSession } from "@/lib/session";
import { useLayout } from "@/lib/layout";
import { StoreHeader } from "@/components/store-header";
import { color, fontSize, radius, space, styles } from "@/theme";

const TABS = [
  { href: "/pos", label: "Sell", icon: ShoppingCart },
  { href: "/pos/delivery", label: "Delivery", icon: Truck },
  { href: "/pos/history", label: "History", icon: Receipt },
  { href: "/pos/settings", label: "Settings", icon: Settings },
  { href: "/pos/sync", label: "Sync", icon: CloudUpload },
] as const;

export default function PosLayout() {
  const { cashier, lock } = useSession();
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const router = useRouter();

  // On a phone the cashier's full name pushes the tabs off screen, so only the
  // avatar and the lock action stay.
  const { compact, expanded } = useLayout();

  if (!cashier) return <Redirect href="/unlock" />;

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <StoreHeader />

      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: compact ? space.xs : space.sm,
          paddingHorizontal: compact ? space.sm : expanded ? space.xl : space.lg,
          paddingVertical: space.sm,
          backgroundColor: color.surface,
          borderBottomWidth: 1,
          borderBottomColor: color.border,
        }}
      >
        {TABS.map((tab) => {
          const active = pathname === tab.href;
          const TabIcon = tab.icon;

          return (
            <Pressable
              key={tab.href}
              onPress={() => router.replace(tab.href)}
              style={{
                minHeight: 44,
                flexDirection: "row",
                alignItems: "center",
                gap: space.xs,
                paddingHorizontal: compact ? space.sm : space.md,
                justifyContent: "center",
                borderRadius: radius.sm,
                // The active tab is a filled pill rather than a hairline
                // underline, which vanishes under shop-floor glare.
                backgroundColor: active ? color.primarySoft : "transparent",
              }}
            >
              <TabIcon
                size={18}
                color={active ? color.primary : color.inkMuted}
                strokeWidth={active ? 2.25 : 2}
              />
              <Text
                numberOfLines={1}
                style={{
                  fontSize: compact ? fontSize.caption : fontSize.body,
                  fontWeight: "600",
                  color: active ? color.primary : color.inkMuted,
                }}
              >
                {tab.label}
              </Text>
            </Pressable>
          );
        })}

        <Pressable
          onPress={() => {
            lock();
            router.replace("/unlock");
          }}
          accessibilityRole="button"
          accessibilityLabel={`Lock terminal, signed in as ${cashier.name}`}
          style={{
            marginLeft: "auto",
            minHeight: 44,
            paddingLeft: space.sm,
            flexDirection: "row",
            alignItems: "center",
            gap: space.sm,
          }}
        >
          <View
            style={{
              width: 32,
              height: 32,
              borderRadius: 16,
              backgroundColor: color.primary,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text
              style={{
                fontSize: fontSize.caption,
                fontWeight: "700",
                color: color.onPrimary,
              }}
            >
              {cashier.name.slice(0, 1).toUpperCase()}
            </Text>
          </View>
          {compact ? null : (
            <Text style={{ fontSize: fontSize.body, color: color.ink }} numberOfLines={1}>
              {cashier.name}
            </Text>
          )}
          <LogOut size={16} color={color.inkMuted} strokeWidth={2} />
        </Pressable>
      </View>

      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: color.paper } }} />
    </View>
  );
}
