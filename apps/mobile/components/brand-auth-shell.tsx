import type { ReactNode } from "react";
import {
  Image,
  ImageBackground,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { color, fontSize, space } from "@/theme";

const BANNER = require("../assets/banner.png");
const LOGO = require("../assets/logo.png");
const POWERED_BY_EMAIL = "doubleadigitalsolutions@gmail.com";
const POWERED_BY_MAILTO = `mailto:${POWERED_BY_EMAIL}`;

/**
 * Full-bleed shop banner behind unlock / setup. Same treatment as the admin
 * login page: photo + ink wash so surface cards stay readable on top.
 */
export function BrandAuthShell({ children }: { children: ReactNode }) {
  return (
    <View style={{ flex: 1 }}>
      <StatusBar style="light" />
      <ImageBackground
        source={BANNER}
        resizeMode="cover"
        style={StyleSheet.absoluteFill}
        accessibilityIgnoresInvertColors
      />
      <View
        pointerEvents="none"
        accessibilityElementsHidden
        style={[StyleSheet.absoluteFill, { backgroundColor: `${color.ink}8C` }]}
      />
      {children}
    </View>
  );
}

/**
 * Vendor credit bar — white strip at the bottom of unlock, setup, and POS.
 * `onBanner` kept for call sites; look is the same white bar either way.
 */
export function PoweredByLabel({ onBanner: _onBanner = false }: { onBanner?: boolean }) {
  const insets = useSafeAreaInsets();

  return (
    <View
      style={{
        backgroundColor: color.surface,
        borderTopWidth: 1,
        borderTopColor: color.border,
        paddingTop: space.sm,
        paddingHorizontal: space.md,
        paddingBottom: Math.max(insets.bottom, space.sm),
      }}
    >
      <Pressable
        onPress={() => void Linking.openURL(POWERED_BY_MAILTO)}
        accessibilityRole="link"
        accessibilityLabel={`Powered by ${POWERED_BY_EMAIL}, 2026`}
        style={({ pressed }) => ({
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: space.sm,
          paddingVertical: space.xs,
          opacity: pressed ? 0.85 : 1,
        })}
      >
        <Image
          source={LOGO}
          style={{ width: 28, height: 28 }}
          resizeMode="contain"
          accessibilityIgnoresInvertColors
        />
        <View style={{ flexShrink: 1, minWidth: 0, gap: 2 }}>
          <Text
            style={{
              fontSize: fontSize.caption,
              fontWeight: "700",
              letterSpacing: 0.3,
              color: color.inkMuted,
            }}
          >
            Powered by · 2026
          </Text>
          <Text
            numberOfLines={1}
            style={{
              fontSize: fontSize.body,
              fontWeight: "700",
              color: color.primary,
              textDecorationLine: "underline",
            }}
          >
            {POWERED_BY_EMAIL}
          </Text>
        </View>
      </Pressable>
    </View>
  );
}

/** Light text for chrome sitting on the banner (titles outside cards). */
export const authChrome = {
  heading: {
    fontSize: fontSize.headingMd,
    fontWeight: "600" as const,
    color: color.onPrimary,
  },
  subheading: {
    fontSize: fontSize.headingSm,
    fontWeight: "600" as const,
    color: color.onPrimary,
  },
  muted: {
    fontSize: fontSize.body,
    color: "rgba(255,255,255,0.75)",
  },
  caption: {
    fontSize: fontSize.caption,
    color: "rgba(255,255,255,0.7)",
  },
};
