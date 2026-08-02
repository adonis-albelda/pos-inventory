import { ActivityIndicator, Image, Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { ChevronRight } from "lucide-react-native";
import { storeInitial } from "@double-a/shared-types";
import { useStoreSettings } from "@/lib/store";
import { useLayout } from "@/lib/layout";
import { useSync } from "@/sync/sync-provider";
import { pendingLabel, syncLook, useMinuteTick } from "@/sync/status";
import { color, fontSize, radius, space } from "@/theme";

/**
 * The band above the tabs: whose shop this is, and how far behind the terminal
 * is.
 *
 * The sync actions themselves live on the Sync tab, but the state does not — it
 * stays on every POS screen, coloured teal, amber or terracotta the same way the
 * sync bar is, and the whole chip is a tap through to the tab. A cashier should
 * never have to go looking to find out that nothing has been sent since morning.
 */
export function StoreHeader() {
  const store = useStoreSettings();
  const state = useSync();
  const router = useRouter();
  const { compact, expanded } = useLayout();

  useMinuteTick();
  const look = syncLook(state);
  const StatusIcon = look.icon;

  const logoSize = compact ? 36 : 42;

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: compact ? space.sm : space.md,
        paddingHorizontal: compact ? space.md : expanded ? space.xl : space.lg,
        paddingVertical: compact ? space.sm : space.md,
        backgroundColor: color.surface,
        borderBottomWidth: 1,
        borderBottomColor: color.border,
      }}
    >
      <View
        style={{
          width: logoSize,
          height: logoSize,
          borderRadius: radius.sm,
          overflow: "hidden",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: store.logoUrl ? color.paper : color.primary,
        }}
      >
        {store.logoUrl ? (
          // A logo is fetched over the network and cached by the image loader.
          // A terminal that has never been online falls back to the initial
          // rather than showing a gap — nothing here may wait on a connection.
          <Image
            source={{ uri: store.logoUrl }}
            resizeMode="contain"
            style={{ width: "100%", height: "100%" }}
            accessibilityIgnoresInvertColors
          />
        ) : (
          <Text
            style={{
              fontSize: fontSize.headingSm,
              fontWeight: "700",
              color: color.onPrimary,
            }}
          >
            {storeInitial(store.name)}
          </Text>
        )}
      </View>

      <View style={{ flex: 1, minWidth: 0 }}>
        <Text
          numberOfLines={1}
          style={{ fontSize: fontSize.bodyLg, fontWeight: "700", color: color.ink }}
        >
          {store.name}
        </Text>
        {!compact && store.address ? (
          <Text
            numberOfLines={1}
            style={{ fontSize: fontSize.caption, color: color.inkMuted }}
          >
            {store.address}
          </Text>
        ) : null}
      </View>

      <Pressable
        onPress={() => router.replace("/pos/sync")}
        accessibilityRole="button"
        accessibilityLabel={`${look.text}. ${pendingLabel(state.pendingSales)}. Opens sync.`}
        style={({ pressed }) => ({
          minHeight: 48,
          maxWidth: compact ? 150 : 260,
          flexDirection: "row",
          alignItems: "center",
          gap: space.xs,
          paddingLeft: space.sm,
          paddingRight: space.xs,
          borderRadius: radius.sm,
          backgroundColor: look.fill,
          opacity: pressed ? 0.85 : 1,
        })}
      >
        {look.busy ? (
          <ActivityIndicator size="small" color={look.ink} />
        ) : (
          <StatusIcon size={18} color={look.ink} strokeWidth={2} />
        )}

        <View style={{ flexShrink: 1 }}>
          <Text
            numberOfLines={1}
            style={{ fontSize: fontSize.caption, fontWeight: "700", color: look.ink }}
          >
            {compact ? look.shortText : look.text}
          </Text>
          <Text
            numberOfLines={1}
            style={{ fontSize: fontSize.caption, color: color.inkMuted }}
          >
            {pendingLabel(state.pendingSales)}
          </Text>
        </View>

        <ChevronRight size={16} color={look.ink} strokeWidth={2} />
      </Pressable>
    </View>
  );
}
