import { useEffect, useRef, useState } from "react";
import { View } from "react-native";
import { Redirect } from "expo-router";
import { CompanyIntro } from "@/components/company-intro";
import { LoadingState } from "@/components/loading-state";
import { WaveBackdrop } from "@/components/wave-backdrop";
import { getSyncMeta } from "@/db/meta";
import { useSession } from "@/lib/session";
import { isEnrolled } from "@/lib/api/session";

type Boot =
  | { state: "intro" }
  | { state: "checking" }
  | { state: "needs-setup" }
  | { state: "needs-unlock" }
  | { state: "ready" };

/**
 * Cold start: company intro, then enroll / unlock / POS.
 *
 * The enrollment check runs *during* the splash hold, not after it — local
 * SQLite/SecureStore reads finish well inside COMPANY_INTRO_HOLD_MS, so by
 * the time the splash's own timer ends there's almost always already a
 * destination ready and the redirect fires immediately. That's what keeps
 * this from flashing a blank "checking" screen between splash and the next
 * route; the old version only started the check once the splash was gone.
 */
export default function Index() {
  const { cashier } = useSession();
  const [boot, setBoot] = useState<Boot>({ state: "intro" });
  const destination = useRef<Boot | null>(null);
  const introDone = useRef(false);

  useEffect(() => {
    async function check() {
      const [enrolled, meta] = await Promise.all([isEnrolled(), getSyncMeta()]);
      const next: Boot =
        !enrolled || !meta.firstPullDone
          ? { state: "needs-setup" }
          : { state: cashier ? "ready" : "needs-unlock" };

      destination.current = next;
      if (introDone.current) setBoot(next);
    }

    void check();
  }, [cashier]);

  function handleIntroDone() {
    introDone.current = true;
    setBoot(destination.current ?? { state: "checking" });
  }

  if (boot.state === "intro") {
    return <CompanyIntro onDone={handleIntroDone} />;
  }

  if (boot.state === "checking") {
    return (
      <View style={{ flex: 1 }}>
        <WaveBackdrop />
        <LoadingState text="Getting things ready…" />
      </View>
    );
  }

  if (boot.state === "needs-setup") return <Redirect href="/setup" />;
  if (boot.state === "needs-unlock") return <Redirect href="/unlock" />;
  return <Redirect href="/pos" />;
}
