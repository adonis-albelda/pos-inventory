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
 * Vendor credit. `onBanner` for unlock/setup (light text on the photo);
 * default for POS chrome on paper.
 */
export function PoweredByLabel({ onBanner = false }: { onBanner?: boolean }) {
  const insets = useSafeAreaInsets();
  const mute = onBanner ? "rgba(255,255,255,0.55)" : color.inkMuted;
  const link = onBanner ? "rgba(255,255,255,0.7)" : color.ink;

  return (
    <Pressable
      onPress={() => void Linking.openURL(POWERED_BY_MAILTO)}
      accessibilityRole="link"
      accessibilityLabel={`Powered by ${POWERED_BY_EMAIL}`}
      style={{
        flexDirection: "row",
        flexWrap: "wrap",
        alignItems: "center",
        justifyContent: "center",
        gap: space.xs,
        paddingTop: space.sm,
        paddingHorizontal: space.md,
        paddingBottom: onBanner ? Math.max(insets.bottom, space.md) : Math.max(insets.bottom, space.sm),
        borderTopWidth: onBanner ? 0 : StyleSheet.hairlineWidth,
        borderTopColor: color.border,
      }}
    >
      <Image
        source={LOGO}
        style={{ width: 18, height: 18 }}
        resizeMode="contain"
        accessibilityIgnoresInvertColors
      />
      <Text style={{ fontSize: fontSize.caption, color: mute, textAlign: "center" }}>
        Powered by:{" "}
        <Text style={{ textDecorationLine: "underline", color: link }}>{POWERED_BY_EMAIL}</Text>
      </Text>
    </Pressable>
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
