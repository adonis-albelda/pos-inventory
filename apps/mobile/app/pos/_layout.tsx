import { Redirect, Stack } from "expo-router";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useSession } from "@/lib/session";
import { StoreHeader } from "@/components/store-header";
import { styles } from "@/theme";

export default function PosLayout() {
  const { cashier } = useSession();
  const insets = useSafeAreaInsets();

  if (!cashier) return <Redirect href="/unlock" />;

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <StoreHeader />
      <View style={{ flex: 1, minHeight: 0 }}>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: "transparent" },
            // These routes are lateral tabs reached with router.replace(), not a
            // hierarchy — a push/pop slide has no clean "replace" animation and
            // is what reads as one screen mixing into the other. A fade is
            // direction-less and correct for swapping siblings.
            animation: "fade",
            animationDuration: 180,
          }}
        />
      </View>
    </View>
  );
}
