import { useEffect, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { User } from "@double-a/shared-types";
import { currentAppUser } from "@double-a/supabase";
import { getSyncMeta } from "@/db/meta";
import { countLocalProducts } from "@/db/products";
import { getDeviceId, getDeviceLabel, setDeviceLabel, getEnrolledCompanyId, setEnrolledCompanyId } from "@/lib/device";
import { resetLocalData } from "@/db";
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
} from "lucide-react-native";
import {
  AuthBrandMark,
  BrandAuthShell,
  PoweredByLabel,
} from "@/components/brand-auth-shell";
import { Button, Card, ErrorNote, SectionTitle } from "@/components/ui";
import { color, fontSize, radius, space, styles } from "@/theme";

type Step = "sign-in" | "first-pull" | "done";

/**
 * One-time terminal setup — enrollment always requires connectivity.
 *
 * One live sign-in, with whatever credentials the account already has in the
 * database: an admin's dashboard email and password, or a dedicated Terminal
 * account's. Either role may push sales and call verify_pin, so a shop with a
 * single admin login needs nothing extra created before it can sell.
 *
 * The session signed in here is the one persisted on the device, so later syncs
 * need no login. Terminals are told apart by their own device id, not by the
 * account, so two tablets on the same admin login still report separately.
 *
 * Cashier unlock after this hits live verify_pin — local SQLite is only for
 * selling once the shift has started.
 */
export default function SetupScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const layout = useLayout();

  const [step, setStep] = useState<Step>("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [account, setAccount] = useState<User | null>(null);
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

  async function connectTerminal() {
    if (!email.trim() || !password) {
      setError("Enter the email and password for the account.");
      return;
    }

    setBusy(true);
    setError(null);

    try {
      const supabase = getSupabase();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (signInError) {
        setError("That email and password do not match an account.");
        return;
      }

      // Live role check — never trust a local users row here. Signing out on a
      // wrong role matters: an unusable session would otherwise persist and
      // make this device look enrolled on the next cold start.
      const me = await currentAppUser(supabase);

      if (!me) {
        await supabase.auth.signOut();
        setError(
          "That login has no staff record in this shop. Ask an admin to add it under Users.",
        );
        return;
      }

      if (me.role !== "admin" && me.role !== "device") {
        await supabase.auth.signOut();
        setError(
          "Cashiers do not sign in here — they unlock with a PIN once setup is done. Use an admin or Terminal account.",
        );
        return;
      }

      if (!me.companyIsActive) {
        await supabase.auth.signOut();
        setError("This shop account is disabled. Contact the office.");
        return;
      }

      if (!me.companyId) {
        await supabase.auth.signOut();
        setError("This login is not linked to a company.");
        return;
      }

      const storedCompany = await getEnrolledCompanyId();
      if (storedCompany && storedCompany !== me.companyId) {
        await resetLocalData();
      }
      await setEnrolledCompanyId(me.companyId);

      setAccount(me);
      await setDeviceLabel(label.trim() || me.name);
      setPassword("");
      setStep("first-pull");
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Could not reach the server — check the connection and try again",
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
    <View style={{ flex: 1 }}>
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{
        flexGrow: 1,
        justifyContent: "center",
        alignItems: "center",
        paddingHorizontal: layout.gutter,
        paddingTop: insets.top + space.lg,
        paddingBottom: space.xl,
      }}
      keyboardShouldPersistTaps="handled"
    >
      <View
        style={{
          width: "100%",
          maxWidth: 480,
          gap: space.xl,
        }}
      >
        <AuthBrandMark
          title="Set up this terminal"
          subtitle="Sign in once with an admin or Terminal account, then download the catalog. Needs a live connection — not the local copy on this tablet."
        />

        {step === "sign-in" ? (
          <Card style={{ gap: space.md }}>
            <SectionTitle icon={LogIn} title="1. Sign in" />
            <Text style={styles.muted}>
              The same email and password as the admin dashboard, or a Terminal
              account&apos;s. Not a cashier PIN — cashiers unlock after setup.
            </Text>
            <LabelledInput
              label="Email"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
            />
            <LabelledInput
              label="Password"
              value={password}
              onChangeText={setPassword}
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
              label={busy ? "Connecting..." : "Connect this terminal"}
              large
              icon={Smartphone}
              busy={busy}
              onPress={() => void connectTerminal()}
            />
          </Card>
        ) : null}

        {step === "first-pull" ? (
          <Card style={{ gap: space.md }}>
            <SectionTitle icon={CloudDownload} title="2. Download products and cashiers" />
            {account ? (
              <Text style={styles.muted}>
                Connected as {account.name} ({account.email}).
              </Text>
            ) : null}
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

        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: space.xs,
          }}
        >
          <Smartphone size={13} color={color.inkMuted} strokeWidth={2} />
          <Text
            style={[
              styles.numeric,
              { fontSize: fontSize.caption, color: color.inkMuted },
            ]}
          >
            Terminal id {deviceId.slice(0, 8)}
          </Text>
        </View>
      </View>
    </ScrollView>
    <PoweredByLabel />
    </View>
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
      <Text
        style={{
          fontSize: fontSize.caption,
          color: color.inkMuted,
          fontWeight: "700",
          letterSpacing: 0.3,
        }}
      >
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
          backgroundColor: color.paper,
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
