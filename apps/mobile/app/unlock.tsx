import { useCallback, useEffect, useState } from "react";
import { Image, Modal, Pressable, ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  PIN_LENGTH_MAX,
  PIN_LENGTH_MIN,
  storeInitial,
  timeAgo,
  type User,
} from "@double-a/shared-types";
import { listCashiers } from "@double-a/supabase";
import { useLayout } from "@/lib/layout";
import { useSession } from "@/lib/session";
import { ensureFreshSession, getSupabase } from "@/lib/supabase";
import { useStoreSettings } from "@/lib/store";
import { useSync } from "@/sync/sync-provider";
import {
  Check,
  Delete,
  RefreshCw,
  Shield,
  UserRound,
  Users,
  X,
} from "lucide-react-native";
import {
  authChrome,
  BrandAuthShell,
  PoweredByLabel,
} from "@/components/brand-auth-shell";
import { Button, Card, EmptyState, ErrorNote, IconButton } from "@/components/ui";
import { color, fontSize, radius, space, styles } from "@/theme";

/**
 * Start of a shift. Cashier list + PIN check hit live Supabase. Local SQLite
 * is for selling after unlock — never for credentials.
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
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadingList, setLoadingList] = useState(true);
  const [busy, setBusy] = useState(false);

  const loadCashiers = useCallback(async () => {
    setLoadingList(true);
    setLoadError(null);
    try {
      await ensureFreshSession();
      const next = await listCashiers(getSupabase());
      setCashiers(next);
      setSelected((prev) =>
        prev && next.some((c) => c.id === prev.id)
          ? (next.find((c) => c.id === prev.id) ?? null)
          : null,
      );
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Could not reach the server.";
      setLoadError(message);
      setCashiers([]);
    } finally {
      setLoadingList(false);
    }
  }, []);

  useEffect(() => {
    void loadCashiers();
  }, [loadCashiers]);

  const syncing = phase === "pushing" || phase === "pulling";

  /**
   * Pull catalog into SQLite for the shift, then reload the live cashier list.
   * PIN itself is always live — this is for products/prices, not hashes.
   */
  async function refreshCashiers() {
    await pullOnly();
    await loadCashiers();
    setPin("");
    setError(null);
  }

  function closePinDialog() {
    if (busy) return;
    setSelected(null);
    setPin("");
    setError(null);
  }

  async function submit() {
    if (!selected) return;

    setBusy(true);
    setError(null);

    try {
      const ok = await unlock(selected, pin);
      if (!ok) {
        setPin("");
        setError("That PIN does not match. Try again, or ask an admin to reset it.");
        return;
      }
      router.replace("/pos");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Could not reach the server.";
      setError(message);
      setPin("");
    } finally {
      setBusy(false);
    }
  }

  const listWidth = Math.min(layout.width - layout.gutter * 2, 520);
  const cashierCols = listWidth < 400 ? 2 : 3;
  const cashierTileWidth = (listWidth - space.sm * (cashierCols - 1)) / cashierCols;

  return (
    <BrandAuthShell>
    <View style={{ flex: 1 }}>
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
        flexGrow: 1,
        paddingBottom: space.xl,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: space.md,
          padding: space.md,
          backgroundColor: color.surface,
          borderWidth: 1,
          borderColor: color.border,
          borderLeftWidth: 3,
          borderLeftColor: color.primary,
          borderRadius: radius.sm,
        }}
      >
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: radius.sm,
            borderWidth: 1,
            borderColor: store.logoUrl ? color.border : color.primary,
            overflow: "hidden",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: store.logoUrl ? color.surface : color.primary,
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
        <Text numberOfLines={1} style={[authChrome.subheading, { flex: 1 }]}>
          {store.name}
        </Text>
      </View>

      <View style={{ flexDirection: "row", alignItems: "flex-start", gap: space.md }}>
        <View style={{ flex: 1 }}>
          <Text style={authChrome.heading}>Who is on shift?</Text>
          <Text style={[authChrome.muted, { marginTop: space.xs }]}>
            Pick your name, then enter your PIN. Needs a connection.
          </Text>
          <Text
            style={{
              fontSize: fontSize.caption,
              color: loadError || syncError ? color.dangerInk : color.inkMuted,
              marginTop: space.xs,
            }}
          >
            {loadingList || syncing
              ? "Fetching latest data..."
              : (loadError ?? syncError ?? `Last synced: ${timeAgo(lastSyncedAt)}`)}
          </Text>
        </View>

        <Button
          label={syncing || loadingList ? "Refreshing..." : "Refresh"}
          variant="secondary"
          icon={RefreshCw}
          busy={syncing || loadingList}
          onPress={() => void refreshCashiers()}
        />
      </View>

      {cashiers.length === 0 ? (
        <Card>
          <EmptyState
            icon={Users}
            title={
              loadError
                ? "Cannot reach the server"
                : loadingList
                  ? "Loading cashiers..."
                  : "No cashiers yet"
            }
            instruction={
              loadError
                ? "Check the connection, then press Refresh."
                : "Add a cashier in the admin dashboard, then press Refresh."
            }
          />
        </Card>
      ) : (
        <View
          style={{
            flexDirection: "row",
            flexWrap: "wrap",
            gap: space.sm,
          }}
        >
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
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                accessibilityLabel={`${cashier.name}, ${cashier.role === "admin" ? "Admin" : "Cashier"}`}
                style={({ pressed }) => [
                  styles.card,
                  {
                    width: cashierTileWidth,
                    alignItems: "center",
                    justifyContent: "center",
                    gap: space.sm,
                    paddingVertical: space.lg,
                    paddingHorizontal: space.md,
                    minHeight: layout.tileMinHeight,
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
                    width: 56,
                    height: 56,
                    borderRadius: 28,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: active ? color.primary : color.primarySoft,
                  }}
                >
                  {cashier.role === "admin" ? (
                    <Shield
                      size={24}
                      color={active ? color.onPrimary : color.primary}
                      strokeWidth={2}
                    />
                  ) : (
                    <UserRound
                      size={24}
                      color={active ? color.onPrimary : color.primary}
                      strokeWidth={2}
                    />
                  )}
                </View>

                <View style={{ alignItems: "center", gap: space.xs, width: "100%" }}>
                  <Text
                    numberOfLines={2}
                    style={{
                      fontSize: fontSize.bodyLg,
                      fontWeight: "700",
                      color: color.ink,
                      textAlign: "center",
                    }}
                  >
                    {cashier.name}
                  </Text>
                  <Text
                    style={{
                      fontSize: fontSize.caption,
                      fontWeight: "600",
                      color: active ? color.primary : color.inkMuted,
                      textAlign: "center",
                    }}
                  >
                    {cashier.role === "admin" ? "Admin" : "Cashier"}
                  </Text>
                </View>

                {active ? (
                  <View
                    style={{
                      position: "absolute",
                      top: space.sm,
                      right: space.sm,
                    }}
                  >
                    <Check size={18} color={color.primary} strokeWidth={2.5} />
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </View>
      )}

    </ScrollView>

    <PoweredByLabel />

    <Modal
      visible={selected !== null}
      transparent
      animationType="fade"
      onRequestClose={closePinDialog}
    >
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          padding: layout.gutter,
          paddingTop: insets.top + space.md,
          paddingBottom: insets.bottom + space.md,
          backgroundColor: `${color.ink}99`,
        }}
      >
        <Pressable
          onPress={closePinDialog}
          accessibilityRole="button"
          accessibilityLabel="Dismiss"
          style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0 }}
        />

        <View
          style={{
            width: "100%",
            maxWidth: 400,
            alignSelf: "center",
            backgroundColor: color.surface,
            borderRadius: radius.md,
            borderWidth: 1,
            borderColor: color.border,
            padding: space.lg,
            gap: space.lg,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "flex-start", gap: space.sm }}>
            <View style={{ flex: 1, gap: space.xs }}>
              <Text style={styles.subheading}>PIN for {selected?.name}</Text>
              <Text style={styles.muted}>
                {PIN_LENGTH_MIN} to {PIN_LENGTH_MAX} digits.
              </Text>
            </View>
            <IconButton icon={X} label="Close" onPress={closePinDialog} disabled={busy} />
          </View>

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
                      minHeight: 56,
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
                              : color.paper,
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
        </View>
      </View>
    </Modal>
    </View>
    </BrandAuthShell>
  );
}
