import type { ReactNode } from "react";
import { Image, Linking, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { PaperBackdrop } from "@/components/paper-backdrop";
import { color, fontSize, radius, space } from "@/theme";

const LOGO = require("../assets/logo.png");
const POWERED_BY_EMAIL = "doubleadigitalsolutions@gmail.com";
const POWERED_BY_MAILTO = `mailto:${POWERED_BY_EMAIL}`;

/**
 * Chrome behind unlock / setup: flat off-white paper, no photograph. Cards and
 * the teal brand marks are the only things carrying contrast, so a form stays
 * readable in bright shop light where a washed photo did not.
 */
export function BrandAuthShell({ children }: { children: ReactNode }) {
  return (
    <View style={{ flex: 1, backgroundColor: color.paper }}>
      <StatusBar style="dark" />
      <PaperBackdrop />
      {children}
    </View>
  );
}

/**
 * Brand lockup above an auth form: logo tile, title, one teal rule. `logoUrl`
 * is the shop's own logo once a pull has landed; without it the vendor mark
 * stands in, so a terminal that has never been online still reads as branded.
 */
export function AuthBrandMark({
  logoUrl,
  title,
  subtitle,
}: {
  logoUrl?: string | null;
  title: string;
  subtitle?: string;
}) {
  return (
    <View style={{ alignItems: "center", gap: space.md }}>
      <View
        style={{
          width: 76,
          height: 76,
          borderRadius: radius.sm,
          borderWidth: 1,
          borderColor: color.border,
          backgroundColor: color.surface,
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
          padding: space.sm,
        }}
      >
        <Image
          source={logoUrl ? { uri: logoUrl } : LOGO}
          style={{ width: "100%", height: "100%" }}
          resizeMode="contain"
          accessibilityIgnoresInvertColors
        />
      </View>

      <View style={{ alignItems: "center", gap: space.xs }}>
        <Text style={[authChrome.heading, { textAlign: "center" }]}>{title}</Text>
        {subtitle ? (
          <Text style={[authChrome.muted, { textAlign: "center" }]}>{subtitle}</Text>
        ) : null}
      </View>

      <View style={{ width: 44, height: 3, backgroundColor: color.primary }} />
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

/** Text for chrome sitting on paper (titles outside cards). */
export const authChrome = {
  heading: {
    fontSize: fontSize.headingMd,
    fontWeight: "700" as const,
    color: color.ink,
  },
  subheading: {
    fontSize: fontSize.headingSm,
    fontWeight: "700" as const,
    color: color.ink,
  },
  muted: {
    fontSize: fontSize.body,
    lineHeight: 20,
    color: color.inkMuted,
  },
  caption: {
    fontSize: fontSize.caption,
    color: color.inkMuted,
  },
};
