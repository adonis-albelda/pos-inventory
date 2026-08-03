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
  COMPANY_NAME,
  COMPANY_TAGLINE_MS,
  COMPANY_TAGLINES,
} from "@double-a/ui";
import { color, fontSize, space } from "@/theme";

const LOGO = require("../assets/logo.png");

/**
 * Cold-start marketing screen for DOUBLE A Digital Solutions. Cycles taglines
 * one at a time, then yields to the real boot route. Tap skips ahead.
 */
export function CompanyIntro({ onDone }: { onDone: () => void }) {
  const [index, setIndex] = useState(0);
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(12)).current;
  const logoScale = useRef(new Animated.Value(0.92)).current;
  const finished = useRef(false);

  function finish() {
    if (finished.current) return;
    finished.current = true;
    onDone();
  }

  useEffect(() => {
    Animated.spring(logoScale, {
      toValue: 1,
      friction: 7,
      tension: 60,
      useNativeDriver: true,
    }).start();
  }, [logoScale]);

  useEffect(() => {
    opacity.setValue(0);
    translateY.setValue(12);

    const fadeIn = Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 420,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 420,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]);

    const hold = Animated.delay(COMPANY_TAGLINE_MS);

    const fadeOut = Animated.timing(opacity, {
      toValue: 0,
      duration: 320,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    });

    const sequence = Animated.sequence([fadeIn, hold, fadeOut]);
    sequence.start(({ finished: ok }) => {
      if (!ok || finished.current) return;
      if (index >= COMPANY_TAGLINES.length - 1) {
        finish();
        return;
      }
      setIndex((current) => current + 1);
    });

    return () => sequence.stop();
    // finish closes over onDone; index drives the cycle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, opacity, translateY]);

  return (
    <Pressable
      onPress={finish}
      accessibilityRole="button"
      accessibilityLabel="Continue"
      style={{
        flex: 1,
        backgroundColor: color.paper,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: space.xl,
      }}
    >
      <Animated.View
        style={{
          alignItems: "center",
          gap: space.lg,
          transform: [{ scale: logoScale }],
        }}
      >
        <View
          style={{
            width: 112,
            height: 112,
            borderRadius: 0,
            borderWidth: 1,
            borderColor: color.border,
            backgroundColor: color.surface,
            alignItems: "center",
            justifyContent: "center",
            padding: space.md,
          }}
        >
          <Image
            source={LOGO}
            style={{ width: 80, height: 80 }}
            resizeMode="contain"
            accessibilityIgnoresInvertColors
          />
        </View>

        <View style={{ alignItems: "center", gap: space.md }}>
          <Text
            style={{
              fontSize: fontSize.headingSm,
              fontWeight: "800",
              letterSpacing: 1.4,
              color: color.ink,
              textAlign: "center",
            }}
          >
            {COMPANY_NAME}
          </Text>
          <View style={{ width: 44, height: 3, backgroundColor: color.primary }} />
        </View>
      </Animated.View>

      <View
        style={{
          marginTop: space["2xl"],
          minHeight: 72,
          width: "100%",
          maxWidth: 360,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Animated.Text
          style={{
            opacity,
            transform: [{ translateY }],
            fontSize: fontSize.bodyLg,
            fontWeight: "500",
            lineHeight: 24,
            color: color.inkMuted,
            textAlign: "center",
          }}
        >
          {COMPANY_TAGLINES[index]}
        </Animated.Text>
      </View>

      <Text
        style={{
          position: "absolute",
          bottom: space["3xl"],
          fontSize: fontSize.caption,
          fontWeight: "600",
          color: color.inkMuted,
          letterSpacing: 0.4,
        }}
      >
        Tap to continue
      </Text>
    </Pressable>
  );
}
