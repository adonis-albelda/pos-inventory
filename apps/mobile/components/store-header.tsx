import { useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { usePathname, useRouter } from "expo-router";
import {
  ChevronRight,
  CloudUpload,
  Receipt,
  Settings,
  ShoppingCart,
  Truck,
} from "lucide-react-native";
import { storeInitial } from "@double-a/shared-types";
import { AccountDrawer } from "@/components/account-drawer";
import { useStoreSettings } from "@/lib/store";
import { useLayout } from "@/lib/layout";
import { useSync } from "@/sync/sync-provider";
import { pendingLabel, syncLook, useMinuteTick } from "@/sync/status";
import { color, fontSize, radius, space } from "@/theme";

const TABS = [
  { href: "/pos", label: "Sell", icon: ShoppingCart },
  { href: "/pos/delivery", label: "Delivery", icon: Truck },
  { href: "/pos/history", label: "History", icon: Receipt },
  { href: "/pos/settings", label: "Settings", icon: Settings },
  { href: "/pos/sync", label: "Sync", icon: CloudUpload },
] as const;

/**
 * One chrome row on every POS screen: logo (opens account drawer), shop name,
 * tabs, sync chip. Chip taps through to Sync — does not sync itself.
 */
export function StoreHeader() {
  const store = useStoreSettings();
  const state = useSync();
  const router = useRouter();
  const pathname = usePathname();
  const { compact, expanded } = useLayout();
  const [drawerOpen, setDrawerOpen] = useState(false);

  useMinuteTick();
  const look = syncLook(state);
  const StatusIcon = look.icon;

  const logoSize = compact ? 32 : 36;

  return (
    <>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: compact ? space.xs : space.sm,
          paddingHorizontal: compact ? space.sm : expanded ? space.xl : space.lg,
          paddingVertical: compact ? space.xs : space.sm,
          backgroundColor: color.surface,
          borderBottomWidth: 1,
          borderBottomColor: color.border,
        }}
      >
        <Pressable
          onPress={() => setDrawerOpen(true)}
          accessibilityRole="button"
          accessibilityLabel={`${store.name}. Open account.`}
          style={({ pressed }) => ({
            width: logoSize,
            height: logoSize,
            borderRadius: radius.sm,
            overflow: "hidden",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: store.logoUrl ? color.paper : color.primary,
            opacity: pressed ? 0.85 : 1,
          })}
        >
          {store.logoUrl ? (
            <Image
              source={{ uri: store.logoUrl }}
              resizeMode="contain"
              style={{ width: "100%", height: "100%" }}
              accessibilityIgnoresInvertColors
            />
          ) : (
            <Text
              style={{
                fontSize: compact ? fontSize.body : fontSize.bodyLg,
                fontWeight: "700",
                color: color.onPrimary,
              }}
            >
              {storeInitial(store.name)}
            </Text>
          )}
        </Pressable>

        <Text
          numberOfLines={1}
          style={{
            maxWidth: compact ? 88 : 160,
            fontSize: compact ? fontSize.caption : fontSize.body,
            fontWeight: "700",
            color: color.ink,
            flexShrink: 1,
          }}
        >
          {store.name}
        </Text>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{
            flexDirection: "row",
            alignItems: "center",
            gap: compact ? space.xs : space.sm,
            paddingHorizontal: space.xs,
          }}
          style={{ flex: 1, minWidth: 0 }}
        >
          {TABS.map((tab) => {
            const active = pathname === tab.href;
            const TabIcon = tab.icon;

            return (
              <Pressable
                key={tab.href}
                onPress={() => router.replace(tab.href)}
                accessibilityRole="button"
                accessibilityLabel={tab.label}
                style={{
                  minHeight: 40,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: space.xs,
                  paddingHorizontal: compact ? space.sm : space.md,
                  justifyContent: "center",
                  borderRadius: radius.sm,
                  backgroundColor: active ? color.primarySoft : "transparent",
                }}
              >
                <TabIcon
                  size={18}
                  color={active ? color.primary : color.inkMuted}
                  strokeWidth={active ? 2.25 : 2}
                />
                {compact ? null : (
                  <Text
                    numberOfLines={1}
                    style={{
                      fontSize: fontSize.body,
                      fontWeight: "600",
                      color: active ? color.primary : color.inkMuted,
                    }}
                  >
                    {tab.label}
                  </Text>
                )}
              </Pressable>
            );
          })}
        </ScrollView>

        <Pressable
          onPress={() => router.replace("/pos/sync")}
          accessibilityRole="button"
          accessibilityLabel={`${look.text}. ${pendingLabel(state.pendingSales)}. Opens sync.`}
          style={({ pressed }) => ({
            minHeight: 40,
            maxWidth: compact ? 120 : 220,
            flexDirection: "row",
            alignItems: "center",
            gap: space.xs,
            paddingLeft: space.sm,
            paddingRight: compact ? space.sm : space.xs,
            borderRadius: radius.sm,
            backgroundColor: look.fill,
            opacity: pressed ? 0.85 : 1,
            flexShrink: 0,
          })}
        >
          {look.busy ? (
            <ActivityIndicator size="small" color={look.ink} />
          ) : (
            <StatusIcon size={16} color={look.ink} strokeWidth={2} />
          )}

          <View style={{ flexShrink: 1, minWidth: 0 }}>
            <Text
              numberOfLines={1}
              style={{ fontSize: fontSize.caption, fontWeight: "700", color: look.ink }}
            >
              {compact ? look.shortText : look.text}
            </Text>
            {compact ? null : (
              <Text
                numberOfLines={1}
                style={{ fontSize: fontSize.caption, color: color.inkMuted }}
              >
                {pendingLabel(state.pendingSales)}
              </Text>
            )}
          </View>

          {compact ? null : <ChevronRight size={16} color={look.ink} strokeWidth={2} />}
        </Pressable>
      </View>

      <AccountDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </>
  );
}
