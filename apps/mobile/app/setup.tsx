import { useEffect, useState } from "react";
import { ScrollView, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getSyncMeta } from "@/db/meta";
import { countLocalProducts } from "@/db/products";
import { getDeviceId, getDeviceLabel, setDeviceLabel } from "@/lib/device";
import { useLayout } from "@/lib/layout";
import { getSupabase, isEnrolled } from "@/lib/supabase";
import { runFirstPull } from "@/sync";
import {
  CheckCircle2,
  CloudDownload,
  LogIn,
  PlayCircle,
  Smartphone,
} from "lucide-react-native";
import { Button, Card, ErrorNote, SectionTitle } from "@/components/ui";
import { color, fontSize, radius, space, styles } from "@/theme";

type Step = "enroll" | "first-pull" | "done";

/**
 * One-time terminal setup, the only place the app requires connectivity.
 *
 * The terminal signs in once with its own account and that session is kept on
 * device, so every later sync is authenticated without a cashier ever logging in
 * over the network.
 */
export default function SetupScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const layout = useLayout();

  const [step, setStep] = useState<Step>("enroll");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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

  async function enroll() {
    setBusy(true);
    setError(null);

    try {
      const supabase = getSupabase();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (signInError) {
        setError("That email and password do not match a terminal account.");
        return;
      }

      const { data, error: roleError } = await supabase.rpc("current_app_role");
      if (roleError || (data !== "device" && data !== "admin")) {
        await supabase.auth.signOut();
        setError(
          "That account is not set up as a terminal. Ask an admin to add it with the Terminal role.",
        );
        return;
      }

      if (label.trim()) await setDeviceLabel(label.trim());
      setStep("first-pull");
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
    <ScrollView
      style={styles.screen}
      contentContainerStyle={{
        padding: layout.gutter,
        paddingTop: insets.top + space.xl,
        gap: space.lg,
        width: "100%",
        maxWidth: 560,
        alignSelf: "center",
      }}
    >
      <View>
        <Text style={styles.heading}>Set up this terminal</Text>
        <Text style={[styles.muted, { marginTop: space.xs }]}>
          Done once. After this the terminal works offline and only talks to
          Supabase when someone presses Sync.
        </Text>
      </View>

      {step === "enroll" ? (
        <Card style={{ gap: space.md }}>
          <SectionTitle icon={LogIn} title="1. Sign in as this terminal" />
          <LabelledInput
            label="Terminal email"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />
          <LabelledInput
            label="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />
          <LabelledInput
            label="Name this terminal"
            value={label}
            onChangeText={setLabel}
            placeholder="Counter 1"
          />
          {error ? <ErrorNote>{error}</ErrorNote> : null}
          <Button
            label={busy ? "Signing in..." : "Sign in"}
            large
            icon={LogIn}
            busy={busy}
            onPress={() => void enroll()}
          />
        </Card>
      ) : null}

      {step === "first-pull" ? (
        <Card style={{ gap: space.md }}>
          <SectionTitle icon={CloudDownload} title="2. Download products and cashiers" />
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
        <Smartphone size={13} color={color.inkMuted} strokeWidth={2} />
        <Text style={[styles.numeric, { fontSize: fontSize.caption, color: color.inkMuted }]}>
          Terminal id {deviceId.slice(0, 8)}
        </Text>
      </View>
    </ScrollView>
  );
}

function LabelledInput({
  label,
  ...props
}: React.ComponentProps<typeof TextInput> & { label: string }) {
  return (
    <View style={{ gap: space.xs }}>
      <Text style={{ fontSize: fontSize.caption, color: color.inkMuted, fontWeight: "600" }}>
        {label}
      </Text>
      <TextInput
        {...props}
        style={{
          minHeight: 48,
          borderWidth: 1,
          borderColor: color.border,
          borderRadius: radius.sm,
          backgroundColor: color.surface,
          paddingHorizontal: space.md,
          fontSize: fontSize.bodyLg,
          color: color.ink,
        }}
        placeholderTextColor={color.inkMuted}
      />
    </View>
  );
}
