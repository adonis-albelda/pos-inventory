import { useEffect, useState } from "react";
import { Image, Pressable, ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  PIN_LENGTH_MAX,
  PIN_LENGTH_MIN,
  storeInitial,
  timeAgo,
  type User,
} from "@double-a/shared-types";
import { listCashiers } from "@/db/users";
import { useLayout } from "@/lib/layout";
import { useSession } from "@/lib/session";
import { useStoreSettings } from "@/lib/store";
import { useSync } from "@/sync/sync-provider";
import {
  Check,
  Delete,
  RefreshCw,
  Shield,
  UserRound,
  Users,
} from "lucide-react-native";
import { Button, Card, EmptyState, ErrorNote } from "@/components/ui";
import { color, fontSize, radius, space, styles } from "@/theme";

/**
 * Start of a shift. Entirely offline: the cashier list and their PIN hashes came
 * down on the last sync, so a terminal with no signal still opens.
 */
export default function UnlockScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const layout = useLayout();
  const { unlock } = useSession();
  const { phase, lastSyncedAt, error: syncError, pullOnly } = useSync();
  const store = useStoreSettings();

  const [cashiers, setCashiers] = useState<User[]>([]);
  const [selected, setSelected] = useState<User | null>(null);
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void listCashiers().then(setCashiers);
  }, []);

  const syncing = phase === "pushing" || phase === "pulling";

  /**
   * The only way out of a locked terminal whose PIN was changed in admin after
   * the last sync — without it the cashier list and hashes here can never
   * catch up.
   */
  async function refreshCashiers() {
    await pullOnly();
    setCashiers(await listCashiers());
    setPin("");
    setError(null);
  }

  async function submit() {
    if (!selected) return;

    setBusy(true);
    setError(null);

    const ok = await unlock(selected.id, pin);
    setBusy(false);

    if (!ok) {
      setPin("");
      setError("That PIN does not match. Try again, or ask an admin to reset it.");
      return;
    }

    router.replace("/pos");
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={{
        padding: layout.gutter,
        paddingTop: insets.top + space.xl,
        gap: space.lg,
        // The keypad is thumb-sized, not screen-sized: on a tablet it keeps a
        // column width rather than stretching to arm's reach.
        width: "100%",
        maxWidth: 520,
        alignSelf: "center",
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: space.md }}>
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: radius.sm,
            overflow: "hidden",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: store.logoUrl ? color.paper : color.primary,
          }}
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
                fontSize: fontSize.headingSm,
                fontWeight: "700",
                color: color.onPrimary,
              }}
            >
              {storeInitial(store.name)}
            </Text>
          )}
        </View>
        <Text numberOfLines={1} style={[styles.subheading, { flex: 1 }]}>
          {store.name}
        </Text>
      </View>

      <View style={{ flexDirection: "row", alignItems: "flex-start", gap: space.md }}>
        <View style={{ flex: 1 }}>
          <Text style={styles.heading}>Who is on shift?</Text>
          <Text style={[styles.muted, { marginTop: space.xs }]}>
            Pick your name, then enter your PIN.
          </Text>
          <Text
            style={{
              fontSize: fontSize.caption,
              color: syncError ? color.danger : color.inkMuted,
              marginTop: space.xs,
            }}
          >
            {syncing
              ? "Fetching latest data..."
              : (syncError ?? `Last synced: ${timeAgo(lastSyncedAt)}`)}
          </Text>
        </View>

        <Button
          label={syncing ? "Refreshing..." : "Refresh"}
          variant="secondary"
          icon={RefreshCw}
          busy={syncing}
          onPress={() => void refreshCashiers()}
        />
      </View>

      {cashiers.length === 0 ? (
        <Card>
          <EmptyState
            icon={Users}
            title="No cashiers on this terminal yet"
            instruction="Press Refresh once there is a connection to bring the cashier list down."
          />
        </Card>
      ) : (
        <View style={{ gap: space.sm }}>
          {cashiers.map((cashier) => {
            const active = selected?.id === cashier.id;
            return (
              <Pressable
                key={cashier.id}
                onPress={() => {
                  setSelected(cashier);
                  setPin("");
                  setError(null);
                }}
                style={({ pressed }) => [
                  styles.card,
                  {
                    flexDirection: "row",
                    alignItems: "center",
                    gap: space.md,
                    padding: space.lg,
                    minHeight: 64,
                    borderColor: active ? color.primary : color.border,
                    borderWidth: active ? 2 : 1,
                    backgroundColor: pressed
                      ? color.primarySoft
                      : active
                        ? color.primaryTint
                        : color.surface,
                  },
                ]}
              >
                <View
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 22,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: active ? color.primary : color.primarySoft,
                  }}
                >
                  {cashier.role === "admin" ? (
                    <Shield
                      size={18}
                      color={active ? color.onPrimary : color.primary}
                      strokeWidth={2}
                    />
                  ) : (
                    <UserRound
                      size={18}
                      color={active ? color.onPrimary : color.primary}
                      strokeWidth={2}
                    />
                  )}
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: fontSize.bodyLg, fontWeight: "600" }}>
                    {cashier.name}
                  </Text>
                  <Text style={styles.muted}>
                    {cashier.role === "admin" ? "Admin" : "Cashier"}
                  </Text>
                </View>

                {active ? (
                  <Check size={20} color={color.primary} strokeWidth={2.5} />
                ) : null}
              </Pressable>
            );
          })}
        </View>
      )}

      {selected ? (
        <Card style={{ gap: space.lg }}>
          <Text style={styles.subheading}>PIN for {selected.name}</Text>
          <Text style={[styles.muted, { marginTop: -space.md }]}>
            {PIN_LENGTH_MIN} to {PIN_LENGTH_MAX} digits.
          </Text>

          <View style={{ flexDirection: "row", gap: space.sm, justifyContent: "center" }}>
            {Array.from({ length: PIN_LENGTH_MAX }).map((_, index) => {
              const filled = index < pin.length;
              return (
                <View
                  key={index}
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: 10,
                    borderWidth: filled ? 0 : 1,
                    // Past the minimum the remaining dots are optional, so they
                    // stay faint rather than reading as digits still owed.
                    borderColor:
                      index < PIN_LENGTH_MIN ? color.primarySoft : color.borderSoft,
                    backgroundColor: filled ? color.primary : "transparent",
                  }}
                />
              );
            })}
          </View>

          <View style={{ gap: space.sm }}>
            {[
              ["1", "2", "3"],
              ["4", "5", "6"],
              ["7", "8", "9"],
              ["clear", "0", "enter"],
            ].map((row) => (
              <View key={row.join()} style={{ flexDirection: "row", gap: space.sm }}>
                {row.map((key) => (
                  <Pressable
                    key={key}
                    onPress={() => {
                      if (key === "clear") {
                        setPin("");
                        return;
                      }
                      if (key === "enter") {
                        void submit();
                        return;
                      }
                      if (pin.length < PIN_LENGTH_MAX) setPin(pin + key);
                    }}
                    disabled={busy}
                    accessibilityLabel={
                      key === "clear" ? "Clear PIN" : key === "enter" ? "Start shift" : key
                    }
                    style={({ pressed }) => ({
                      flex: 1,
                      minHeight: 64,
                      flexDirection: "row",
                      gap: space.xs,
                      alignItems: "center",
                      justifyContent: "center",
                      borderRadius: radius.sm,
                      borderWidth: key === "enter" ? 0 : 1,
                      borderColor:
                        key === "clear" ? color.dangerSoft : color.primarySoft,
                      backgroundColor:
                        key === "enter"
                          ? color.primary
                          : pressed
                            ? color.primarySoft
                            : key === "clear"
                              ? color.dangerSoft
                              : color.surface,
                    })}
                  >
                    {key === "clear" ? (
                      <Delete size={20} color={color.dangerInk} strokeWidth={2} />
                    ) : key === "enter" ? (
                      <Check size={20} color={color.onPrimary} strokeWidth={2.5} />
                    ) : null}
                    <Text
                      style={{
                        fontSize: fontSize.headingSm,
                        fontWeight: "600",
                        color:
                          key === "enter"
                            ? color.onPrimary
                            : key === "clear"
                              ? color.dangerInk
                              : color.ink,
                      }}
                    >
                      {key === "clear" ? "Clear" : key === "enter" ? "Enter" : key}
                    </Text>
                  </Pressable>
                ))}
              </View>
            ))}
          </View>

          {error ? <ErrorNote>{error}</ErrorNote> : null}

          <Button
            label={busy ? "Checking..." : "Start shift"}
            large
            icon={Check}
            busy={busy}
            disabled={pin.length < PIN_LENGTH_MIN}
            onPress={() => void submit()}
          />
        </Card>
      ) : null}
    </ScrollView>
  );
}
