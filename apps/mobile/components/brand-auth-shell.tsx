import type { ReactNode } from "react";
import {
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
const POWERED_BY_URL = "https://doubleadigitalsolutions.com";

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

/** Footer credit under unlock / setup content. */
export function PoweredByLabel() {
  const insets = useSafeAreaInsets();

  return (
    <Pressable
      onPress={() => void Linking.openURL(POWERED_BY_URL)}
      accessibilityRole="link"
      accessibilityLabel="Powered by doubleadigitalsolutions.com"
      style={{
        paddingTop: space.lg,
        paddingBottom: Math.max(insets.bottom, space.md),
        alignItems: "center",
      }}
    >
      <Text
        style={{
          fontSize: fontSize.caption,
          color: "rgba(255,255,255,0.55)",
          textAlign: "center",
        }}
      >
        Powered by{" "}
        <Text style={{ textDecorationLine: "underline", color: "rgba(255,255,255,0.7)" }}>
          doubleadigitalsolutions.com
        </Text>
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
