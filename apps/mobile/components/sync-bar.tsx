import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { CloudUpload, RefreshCw } from "lucide-react-native";
import { useSync } from "@/sync/sync-provider";
import { pendingLabel, syncLook, useMinuteTick } from "@/sync/status";
import { useLayout } from "@/lib/layout";
import { color, fontSize, radius, space } from "@/theme";

/**
 * The two sync actions and their state, in full.
 *
 * This lives on the sync tab now rather than above every screen — the store
 * header carries the state and a way in. What stays true is that the state is
 * never buried: the bar takes the colour of it, teal when everything is sent,
 * amber once the last sync is more than four hours old, terracotta when it
 * failed, so syncing stays a habit rather than a rescue.
 */
export function SyncBar() {
  const state = useSync();
  const { pendingSales, sync, pullOnly } = state;

  // A phone has no room for two labelled buttons beside the status, so Refresh
  // drops to its icon. Sync keeps its label — it is the action that matters.
  const { compact, expanded } = useLayout();

  useMinuteTick();
  const look = syncLook(state);
  const StatusIcon = look.icon;

  return (
    <View
      style={{
        backgroundColor: look.fill,
        borderBottomWidth: 1,
        borderBottomColor: color.border,
        paddingHorizontal: compact ? space.md : expanded ? space.xl : space.lg,
        paddingVertical: compact ? space.sm : space.md,
        flexDirection: "row",
        alignItems: "center",
        gap: compact ? space.sm : space.md,
      }}
    >
      <View
        style={{
          width: compact ? 36 : 40,
          height: compact ? 36 : 40,
          borderRadius: radius.sm,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: color.surface,
        }}
      >
        {look.busy ? (
          <ActivityIndicator size="small" color={color.primary} />
        ) : (
          <StatusIcon size={20} color={look.ink} strokeWidth={2} />
        )}
      </View>

      <View style={{ flex: 1 }}>
        <Text
          numberOfLines={1}
          style={{ fontSize: fontSize.body, fontWeight: "700", color: look.ink }}
        >
          {look.text}
        </Text>
        <Text
          numberOfLines={1}
          style={{ fontSize: fontSize.caption, color: color.inkMuted }}
        >
          {pendingLabel(pendingSales)}
        </Text>
      </View>

      <Pressable
        onPress={() => void pullOnly()}
        disabled={look.busy}
        accessibilityLabel="Fetch latest products and cashiers"
        style={({ pressed }) => ({
          minHeight: 48,
          minWidth: 48,
          flexDirection: "row",
          alignItems: "center",
          gap: space.xs,
          paddingHorizontal: compact ? space.sm : space.md,
          borderRadius: radius.sm,
          borderWidth: 1,
          borderColor: color.primarySoft,
          justifyContent: "center",
          backgroundColor: pressed ? color.primarySoft : color.surface,
          opacity: look.busy ? 0.6 : 1,
        })}
      >
        <RefreshCw size={compact ? 20 : 16} color={color.primary} strokeWidth={2} />
        {compact ? null : (
          <Text
            style={{ fontSize: fontSize.body, fontWeight: "600", color: color.primary }}
          >
            Refresh
          </Text>
        )}
      </Pressable>

      <Pressable
        onPress={() => void sync()}
        disabled={look.busy}
        accessibilityLabel="Send sales, then fetch latest data"
        style={({ pressed }) => ({
          minHeight: 48,
          flexDirection: "row",
          alignItems: "center",
          gap: space.xs,
          paddingHorizontal: compact ? space.md : space.lg,
          borderRadius: radius.sm,
          justifyContent: "center",
          // Amber is reserved for this one action so it never blends into the
          // regular workflow buttons.
          backgroundColor: color.accent,
          opacity: look.busy ? 0.6 : pressed ? 0.85 : 1,
        })}
      >
        <CloudUpload size={18} color={color.ink} strokeWidth={2} />
        <Text style={{ fontSize: fontSize.body, fontWeight: "700", color: color.ink }}>
          {look.busy ? "Syncing..." : "Sync"}
        </Text>
      </Pressable>
    </View>
  );
}
