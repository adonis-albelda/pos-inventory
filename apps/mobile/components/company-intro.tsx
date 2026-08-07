import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Image,
  Pressable,
  Text,
  View,
} from "react-native";
import {
  COMPANY_INTRO_HOLD_MS,
  COMPANY_LEAD,
  COMPANY_POWERED_BY,
  COMPANY_PRODUCT,
} from "@double-a/ui";
import { SageBackdrop } from "@/components/sage-backdrop";
import { color, fontSize, space } from "@/theme";

const LOGO = require("../assets/logo.png");

/**
 * Cold-start splash: mark, product line, powered-by credit. Tap skips.
 * No rotating slogans — one calm composition.
 */
export function CompanyIntro({ onDone }: { onDone: () => void }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(10)).current;
  const logoScale = useRef(new Animated.Value(0.94)).current;
  const finished = useRef(false);
  const [ready, setReady] = useState(false);

  function finish() {
    if (finished.current) return;
    finished.current = true;
    onDone();
  }

  useEffect(() => {
    Animated.parallel([
      Animated.spring(logoScale, {
        toValue: 1,
        friction: 8,
        tension: 55,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 520,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 520,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start(() => setReady(true));
  }, [logoScale, opacity, translateY]);

  useEffect(() => {
    if (!ready) return;
    const timer = setTimeout(finish, COMPANY_INTRO_HOLD_MS);
    return () => clearTimeout(timer);
    // finish closes over onDone once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  return (
    <Pressable
      onPress={finish}
      accessibilityRole="button"
      accessibilityLabel="Continue"
      style={{
        flex: 1,
        backgroundColor: color.sage,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: space.xl,
      }}
    >
      <SageBackdrop />

      <Animated.View
        style={{
          alignItems: "center",
          maxWidth: 340,
          opacity,
          transform: [{ translateY }, { scale: logoScale }],
        }}
      >
        <Image
          source={LOGO}
          style={{ width: 112, height: 112 }}
          resizeMode="contain"
          accessibilityIgnoresInvertColors
        />

        <Text
          style={{
            marginTop: space.xl,
            fontSize: fontSize.headingSm,
            fontWeight: "800",
            letterSpacing: 2.4,
            color: color.ink,
            textAlign: "center",
          }}
        >
          {COMPANY_LEAD}
        </Text>

        <View
          style={{
            marginTop: space.md,
            width: 40,
            height: 2,
            borderRadius: 1,
            backgroundColor: color.primary,
          }}
        />

        <Text
          style={{
            marginTop: space.md,
            fontSize: fontSize.caption,
            fontWeight: "600",
            letterSpacing: 1.2,
            color: color.inkMuted,
            textTransform: "uppercase",
            textAlign: "center",
          }}
        >
          {COMPANY_PRODUCT}
        </Text>

        <Text
          style={{
            marginTop: space["2xl"],
            fontSize: fontSize.bodyLg,
            fontWeight: "500",
            lineHeight: 26,
            color: color.ink,
            textAlign: "center",
          }}
        >
          {COMPANY_POWERED_BY}
        </Text>
      </Animated.View>

      <Text
        style={{
          position: "absolute",
          bottom: space["3xl"],
          fontSize: fontSize.caption,
          fontWeight: "600",
          color: color.primaryDark,
          letterSpacing: 0.3,
          opacity: 0.75,
        }}
      >
        Tap to continue
      </Text>
    </Pressable>
  );
}
