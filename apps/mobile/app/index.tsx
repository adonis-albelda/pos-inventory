import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { Redirect } from "expo-router";
import { CompanyIntro } from "@/components/company-intro";
import { getSyncMeta } from "@/db/meta";
import { useSession } from "@/lib/session";
import { isEnrolled } from "@/lib/supabase";
import { color, styles } from "@/theme";

type Boot =
  | { state: "intro" }
  | { state: "checking" }
  | { state: "needs-setup" }
  | { state: "needs-unlock" }
  | { state: "ready" };

/**
 * Cold start: company intro, then enroll / unlock / POS.
 */
export default function Index() {
  const { cashier } = useSession();
  const [boot, setBoot] = useState<Boot>({ state: "intro" });

  useEffect(() => {
    if (boot.state === "intro") return;

    async function check() {
      const [enrolled, meta] = await Promise.all([isEnrolled(), getSyncMeta()]);

      if (!enrolled || !meta.firstPullDone) {
        setBoot({ state: "needs-setup" });
        return;
      }

      setBoot({ state: cashier ? "ready" : "needs-unlock" });
    }

    void check();
  }, [cashier, boot.state]);

  if (boot.state === "intro") {
    return <CompanyIntro onDone={() => setBoot({ state: "checking" })} />;
  }

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
