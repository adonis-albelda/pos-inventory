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
  COMPANY_LEAD,
  COMPANY_TAGLINE_MS,
  COMPANY_TAGLINES,
  COMPANY_TRADE,
  COMPANY_TYPE_MS,
} from "@double-a/ui";
import { SageBackdrop } from "@/components/sage-backdrop";
import { color, fontSize, space } from "@/theme";

const LOGO = require("../assets/logo.png");

/**
 * Cold-start marketing screen for DOUBLE A Digital Solutions. Cycles taglines
 * one at a time, then yields to the real boot route. Tap skips ahead.
 */
export function CompanyIntro({ onDone }: { onDone: () => void }) {
  const [index, setIndex] = useState(0);
  const [typed, setTyped] = useState(0);
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(12)).current;
  const logoScale = useRef(new Animated.Value(0.92)).current;
  const caret = useRef(new Animated.Value(1)).current;
  const finished = useRef(false);
  const typing = typed < COMPANY_TRADE.length;

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

  /** Trade name types itself in, one character per tick. */
  useEffect(() => {
    const timer = setInterval(() => {
      setTyped((count) => {
        if (count >= COMPANY_TRADE.length) {
          clearInterval(timer);
          return count;
        }
        return count + 1;
      });
    }, COMPANY_TYPE_MS);

    return () => clearInterval(timer);
  }, []);

  /** Caret blinks while typing, then rests lit for a beat and goes. */
  useEffect(() => {
    if (!typing) {
      Animated.timing(caret, {
        toValue: 0,
        duration: 400,
        delay: 600,
        useNativeDriver: true,
      }).start();
      return;
    }

    const blink = Animated.loop(
      Animated.sequence([
        Animated.timing(caret, {
          toValue: 0.15,
          duration: 260,
          useNativeDriver: true,
        }),
        Animated.timing(caret, {
          toValue: 1,
          duration: 260,
          useNativeDriver: true,
        }),
      ]),
    );

    blink.start();
    return () => blink.stop();
  }, [caret, typing]);

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
          gap: space.lg,
          transform: [{ scale: logoScale }],
        }}
      >
        {/* No tile, no border: the mark sits straight on the sage wash. */}
        <Image
          source={LOGO}
          style={{ width: 128, height: 128 }}
          resizeMode="contain"
          accessibilityIgnoresInvertColors
        />

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
            {COMPANY_LEAD}
          </Text>

          {/*
            One Text, so the caret sits against the last typed character and the
            line does not reflow as it grows. The full string is the label for a
            screen reader, which must not hear it a letter at a time.
          */}
          <Text
            accessibilityLabel={COMPANY_TRADE}
            style={{
              fontSize: fontSize.bodyLg,
              fontWeight: "700",
              letterSpacing: 3,
              color: color.primaryDark,
              textAlign: "center",
            }}
          >
            {COMPANY_TRADE.slice(0, typed)}
            <Animated.Text style={{ opacity: caret, color: color.primary }}>
              |
            </Animated.Text>
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
            fontWeight: "600",
            lineHeight: 24,
            // Sage is mid-tone by the time the tagline sits on it, so muted ink
            // would drop under 4.5:1.
            color: color.ink,
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
          fontWeight: "700",
          color: color.primaryDark,
          letterSpacing: 0.4,
        }}
      >
        Tap to continue
      </Text>
    </Pressable>
  );
}
