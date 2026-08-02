import { Redirect, Stack } from "expo-router";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useSession } from "@/lib/session";
import { StoreHeader } from "@/components/store-header";
import { color, styles } from "@/theme";

export default function PosLayout() {
  const { cashier } = useSession();
  const insets = useSafeAreaInsets();

  if (!cashier) return <Redirect href="/unlock" />;

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <StoreHeader />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: color.paper } }} />
    </View>
  );
}
