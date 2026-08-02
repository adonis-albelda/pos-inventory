import { useEffect, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { migrate } from "@/db";
import { SessionProvider } from "@/lib/session";
import { SyncProvider } from "@/sync/sync-provider";
import { color, space, styles } from "@/theme";

export default function RootLayout() {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The local database is created on first launch, before anything can read it.
  useEffect(() => {
    migrate()
      .then(() => setReady(true))
      .catch((cause: unknown) =>
        setError(cause instanceof Error ? cause.message : "Could not open the database"),
      );
  }, []);

  if (error) {
    return (
      <View style={[styles.screen, { justifyContent: "center", padding: space.xl }]}>
        <Text style={styles.subheading}>This terminal could not start</Text>
        <Text style={[styles.muted, { marginTop: space.sm }]}>{error}</Text>
      </View>
    );
  }

  if (!ready) {
    return (
      <View style={[styles.screen, { justifyContent: "center", alignItems: "center" }]}>
        <ActivityIndicator color={color.primary} />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <SessionProvider>
        <SyncProvider>
          <StatusBar style="dark" />
          <Stack screenOptions={{ headerShown: false }} />
        </SyncProvider>
      </SessionProvider>
    </SafeAreaProvider>
  );
}
