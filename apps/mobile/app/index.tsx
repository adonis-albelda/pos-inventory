import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { Redirect } from "expo-router";
import { getSyncMeta } from "@/db/meta";
import { useSession } from "@/lib/session";
import { isEnrolled } from "@/lib/supabase";
import { color, styles } from "@/theme";

type Boot =
  | { state: "checking" }
  | { state: "needs-setup" }
  | { state: "needs-unlock" }
  | { state: "ready" };

/**
 * Decides where a launch lands: enroll the terminal, pull data for the first
 * time, unlock a cashier, or straight to the POS.
 */
export default function Index() {
  const { cashier } = useSession();
  const [boot, setBoot] = useState<Boot>({ state: "checking" });

  useEffect(() => {
    async function check() {
      const [enrolled, meta] = await Promise.all([isEnrolled(), getSyncMeta()]);

      if (!enrolled || !meta.firstPullDone) {
        setBoot({ state: "needs-setup" });
        return;
      }

      setBoot({ state: cashier ? "ready" : "needs-unlock" });
    }

    void check();
  }, [cashier]);

  if (boot.state === "checking") {
    return (
      <View style={[styles.screen, { justifyContent: "center", alignItems: "center" }]}>
        <ActivityIndicator color={color.primary} />
      </View>
    );
  }

  if (boot.state === "needs-setup") return <Redirect href="/setup" />;
  if (boot.state === "needs-unlock") return <Redirect href="/unlock" />;
  return <Redirect href="/pos" />;
}
