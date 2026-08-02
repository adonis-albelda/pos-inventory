import { useEffect, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { User } from "@double-a/shared-types";
import { listUsers } from "@double-a/supabase";
import { getSyncMeta } from "@/db/meta";
import { countLocalProducts } from "@/db/products";
import { getDeviceId, getDeviceLabel, setDeviceLabel } from "@/lib/device";
import { useLayout } from "@/lib/layout";
import { getSupabase, isEnrolled } from "@/lib/supabase";
import { runFirstPull } from "@/sync";
import {
  CheckCircle2,
  CloudDownload,
  Eye,
  EyeOff,
  LogIn,
  PlayCircle,
  Smartphone,
  Users,
} from "lucide-react-native";
import {
  authChrome,
  BrandAuthShell,
  PoweredByLabel,
} from "@/components/brand-auth-shell";
import { Button, Card, ErrorNote, SectionTitle } from "@/components/ui";
import { color, fontSize, radius, space, styles } from "@/theme";

type Step = "admin-login" | "pick-terminal" | "first-pull" | "done";

/**
 * One-time terminal setup — enrollment always requires connectivity.
 *
 * Flow is deliberate:
 *   1. Admin signs in against live Supabase Auth (never local SQLite).
 *   2. Admin picks a terminal account from the live user list and signs that
 *      terminal in — again live Auth. The persisted session is the terminal's,
 *      so Sync and unlock calls are authenticated as the device.
 *   3. First pull copies products/users into SQLite for offline POS work.
 *
 * Cashier unlock after this also hits live verify_pin — local SQLite is only
 * for selling once the shift has started.
 */
export default function SetupScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const layout = useLayout();

  const [step, setStep] = useState<Step>("admin-login");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [terminals, setTerminals] = useState<User[]>([]);
  const [selectedTerminalId, setSelectedTerminalId] = useState<string | null>(null);
  const [terminalPassword, setTerminalPassword] = useState("");
  const [label, setLabel] = useState("");
  const [deviceId, setDeviceId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pulled, setPulled] = useState<number | null>(null);

  useEffect(() => {
    async function prime() {
      setDeviceId(await getDeviceId());
      setLabel((await getDeviceLabel()) ?? "");

      const [enrolled, meta] = await Promise.all([isEnrolled(), getSyncMeta()]);
      if (enrolled && !meta.firstPullDone) setStep("first-pull");
      if (enrolled && meta.firstPullDone) setStep("done");
    }

    void prime();
  }, []);

  /** Restore the admin session if a terminal sign-in failed mid-way. */
  async function restoreAdminSession(): Promise<void> {
    const supabase = getSupabase();
    const { error: restoreError } = await supabase.auth.signInWithPassword({
      email: adminEmail.trim(),
      password: adminPassword,
    });
    if (restoreError) {
      setStep("admin-login");
      setError("Admin session lost. Sign in as admin again.");
    }
  }

  async function signInAsAdmin() {
    setBusy(true);
    setError(null);

    try {
      const supabase = getSupabase();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: adminEmail.trim(),
        password: adminPassword,
      });

      if (signInError) {
        setError("That email and password do not match an admin account.");
        return;
      }

      // Live role check — never trust a local users row here.
      const { data: role, error: roleError } = await supabase.rpc("current_app_role");
      if (roleError || role !== "admin") {
        await supabase.auth.signOut();
        setError("That account is not an admin. Only an admin can enroll a terminal.");
        return;
      }

      const users = await listUsers(supabase, { includeInactive: false });
      const devices = users.filter((user) => user.role === "device");
      if (devices.length === 0) {
        setError(
          "No terminal accounts exist yet. Add one in admin under Cashiers with the Terminal role.",
        );
        return;
      }

      setTerminals(devices);
      setSelectedTerminalId(devices[0]?.id ?? null);
      setStep("pick-terminal");
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Could not reach Supabase - check the connection and try again",
      );
    } finally {
      setBusy(false);
    }
  }

  async function connectTerminal() {
    const terminal = terminals.find((entry) => entry.id === selectedTerminalId);
    if (!terminal) {
      setError("Pick a terminal to connect.");
      return;
    }
    if (!terminalPassword) {
      setError("Enter that terminal's password.");
      return;
    }

    setBusy(true);
    setError(null);

    try {
      const supabase = getSupabase();

      // Live Auth again — this replaces the admin session with the terminal's.
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: terminal.email,
        password: terminalPassword,
      });

      if (signInError) {
        await restoreAdminSession();
        setError("That terminal password is wrong. Try again.");
        return;
      }

      const { data: role, error: roleError } = await supabase.rpc("current_app_role");
      if (roleError || role !== "device") {
        await supabase.auth.signOut();
        await restoreAdminSession();
        setError("That account is not a terminal. Pick a Terminal-role account.");
        return;
      }

      if (label.trim()) await setDeviceLabel(label.trim());
      else if (terminal.name) await setDeviceLabel(terminal.name);

      setStep("first-pull");
    } catch (cause) {
      await restoreAdminSession();
      setError(
        cause instanceof Error
          ? cause.message
          : "Could not reach Supabase - check the connection and try again",
      );
    } finally {
      setBusy(false);
    }
  }

  async function firstPull() {
    setBusy(true);
    setError(null);

    try {
      await runFirstPull();
      setPulled(await countLocalProducts());
      setStep("done");
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Could not download products - check the connection and try again",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <BrandAuthShell>
    <ScrollView
      style={styles.screen}
      contentContainerStyle={{
        padding: layout.gutter,
        paddingTop: insets.top + space.xl,
        gap: space.lg,
        width: "100%",
        maxWidth: 560,
        alignSelf: "center",
        flexGrow: 1,
      }}
    >
      <View>
        <Text style={authChrome.heading}>Set up this terminal</Text>
        <Text style={[authChrome.muted, { marginTop: space.xs }]}>
          An admin signs in first, then connects this device to a terminal
          account. Both checks hit live Supabase — never the local copy.
        </Text>
      </View>

      {step === "admin-login" ? (
        <Card style={{ gap: space.md }}>
          <SectionTitle icon={LogIn} title="1. Sign in as admin" />
          <Text style={styles.muted}>
            Use the same email and password as the admin dashboard.
          </Text>
          <LabelledInput
            label="Admin email"
            value={adminEmail}
            onChangeText={setAdminEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
          />
          <LabelledInput
            label="Password"
            value={adminPassword}
            onChangeText={setAdminPassword}
            secureTextEntry
            autoComplete="password"
          />
          {error ? <ErrorNote>{error}</ErrorNote> : null}
          <Button
            label={busy ? "Signing in..." : "Sign in as admin"}
            large
            icon={LogIn}
            busy={busy}
            onPress={() => void signInAsAdmin()}
          />
        </Card>
      ) : null}

      {step === "pick-terminal" ? (
        <Card style={{ gap: space.md }}>
          <SectionTitle icon={Users} title="2. Connect a terminal account" />
          <Text style={styles.muted}>
            Pick which terminal this device is, then enter that account's Auth
            password (set under Admin → Cashiers for a Terminal role — not a
            cashier PIN). The session kept on this device is the terminal's.
          </Text>

          <View style={{ gap: space.xs }}>
            {terminals.map((terminal) => {
              const selected = terminal.id === selectedTerminalId;
              return (
                <Pressable
                  key={terminal.id}
                  onPress={() => setSelectedTerminalId(terminal.id)}
                  accessibilityState={{ selected }}
                  style={{
                    minHeight: 52,
                    paddingHorizontal: space.md,
                    paddingVertical: space.sm,
                    borderRadius: radius.sm,
                    borderWidth: 1,
                    borderColor: selected ? color.primary : color.border,
                    backgroundColor: selected ? color.primaryTint : color.surface,
                    justifyContent: "center",
                  }}
                >
                  <Text
                    style={{
                      fontSize: fontSize.body,
                      fontWeight: "700",
                      color: selected ? color.primaryDark : color.ink,
                    }}
                  >
                    {terminal.name}
                  </Text>
                  <Text style={{ fontSize: fontSize.caption, color: color.inkMuted }}>
                    {terminal.email}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <LabelledInput
            label="Terminal password"
            value={terminalPassword}
            onChangeText={setTerminalPassword}
            secureTextEntry
            autoComplete="password"
          />
          <LabelledInput
            label="Name this device"
            value={label}
            onChangeText={setLabel}
            placeholder="Counter 1"
          />
          {error ? <ErrorNote>{error}</ErrorNote> : null}
          <Button
            label={busy ? "Connecting..." : "Connect terminal"}
            large
            icon={Smartphone}
            busy={busy}
            onPress={() => void connectTerminal()}
          />
          <Button
            label="Back to admin sign-in"
            variant="secondary"
            onPress={() => {
              setStep("admin-login");
              setError(null);
              setTerminalPassword("");
            }}
          />
        </Card>
      ) : null}

      {step === "first-pull" ? (
        <Card style={{ gap: space.md }}>
          <SectionTitle icon={CloudDownload} title="3. Download products and cashiers" />
          <Text style={styles.muted}>
            Everything is copied down once so the POS works with no connection.
          </Text>
          {error ? <ErrorNote>{error}</ErrorNote> : null}
          <Button
            label={busy ? "Downloading..." : "Download now"}
            large
            icon={CloudDownload}
            busy={busy}
            onPress={() => void firstPull()}
          />
        </Card>
      ) : null}

      {step === "done" ? (
        <Card style={{ gap: space.md }}>
          <SectionTitle icon={CheckCircle2} title="Ready to sell" />
          <Text style={styles.muted}>
            {pulled === null
              ? "This terminal already has its data."
              : `${pulled} products are on this terminal.`}
          </Text>
          <Button
            label="Start a shift"
            large
            icon={PlayCircle}
            onPress={() => router.replace("/unlock")}
          />
        </Card>
      ) : null}

      <View style={{ flexDirection: "row", alignItems: "center", gap: space.xs }}>
        <Smartphone size={13} color="rgba(255,255,255,0.7)" strokeWidth={2} />
        <Text
          style={[
            styles.numeric,
            { fontSize: fontSize.caption, color: "rgba(255,255,255,0.7)" },
          ]}
        >
          Terminal id {deviceId.slice(0, 8)}
        </Text>
      </View>

      <PoweredByLabel onBanner />
    </ScrollView>
    </BrandAuthShell>
  );
}

function LabelledInput({
  label,
  secureTextEntry,
  ...props
}: React.ComponentProps<typeof TextInput> & { label: string }) {
  const [revealed, setRevealed] = useState(false);
  const isPassword = Boolean(secureTextEntry);

  return (
    <View style={{ gap: space.xs }}>
      <Text style={{ fontSize: fontSize.caption, color: color.inkMuted, fontWeight: "600" }}>
        {label}
      </Text>
      <View
        style={{
          minHeight: 48,
          flexDirection: "row",
          alignItems: "center",
          borderWidth: 1,
          borderColor: color.border,
          borderRadius: radius.sm,
          backgroundColor: color.surface,
          paddingLeft: space.md,
          paddingRight: isPassword ? space.xs : space.md,
        }}
      >
        <TextInput
          {...props}
          secureTextEntry={isPassword && !revealed}
          style={{
            flex: 1,
            minHeight: 48,
            paddingVertical: space.sm,
            fontSize: fontSize.bodyLg,
            color: color.ink,
          }}
          placeholderTextColor={color.inkMuted}
        />
        {isPassword ? (
          <Pressable
            onPress={() => setRevealed((value) => !value)}
            accessibilityRole="button"
            accessibilityLabel={revealed ? "Hide password" : "Show password"}
            hitSlop={8}
            style={{
              width: 44,
              height: 44,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {revealed ? (
              <EyeOff size={20} color={color.inkMuted} strokeWidth={2} />
            ) : (
              <Eye size={20} color={color.inkMuted} strokeWidth={2} />
            )}
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}
