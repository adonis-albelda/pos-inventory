import { Alert, Linking, PermissionsAndroid, Platform } from "react-native";
import type { Permission } from "react-native";

/**
 * Ask Android for the Bluetooth permissions the PT-210 scan/connect needs.
 * Shows a short reason first, then the system dialog. If the cashier previously
 * tapped "Don't ask again", offers to open system Settings.
 *
 * API 31+ needs BLUETOOTH_SCAN + BLUETOOTH_CONNECT at runtime.
 * Older APIs need fine location to discover Classic devices.
 */
export async function ensureBluetoothPermissions(): Promise<boolean> {
  if (Platform.OS !== "android") return true;

  const permissions = runtimeBluetoothPermissions();
  if (permissions.length === 0) return true;

  const already = await Promise.all(
    permissions.map((permission) => PermissionsAndroid.check(permission)),
  );
  if (already.every(Boolean)) return true;

  const proceed = await confirmPrompt();
  if (!proceed) return false;

  const result = await PermissionsAndroid.requestMultiple(permissions);

  const denied = permissions.filter(
    (permission) => result[permission] !== PermissionsAndroid.RESULTS.GRANTED,
  );
  if (denied.length === 0) return true;

  const blocked = denied.some(
    (permission) => result[permission] === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN,
  );

  if (blocked) {
    await offerSettings();
  } else {
    Alert.alert(
      "Bluetooth needed",
      "Allow Bluetooth so this terminal can find and print to the PT-210.",
    );
  }

  return false;
}

function runtimeBluetoothPermissions(): Permission[] {
  const api = typeof Platform.Version === "number" ? Platform.Version : 0;

  if (api >= 31) {
    return [
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
    ].filter((permission): permission is Permission => Boolean(permission));
  }

  // Discovery on Android 11 and below rides on location permission.
  return [PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION].filter(
    (permission): permission is Permission => Boolean(permission),
  );
}

function confirmPrompt(): Promise<boolean> {
  return new Promise((resolve) => {
    Alert.alert(
      "Allow Bluetooth?",
      "DOUBLE A POS needs Bluetooth to find and print receipts on the PT-210 thermal printer.",
      [
        { text: "Not now", style: "cancel", onPress: () => resolve(false) },
        { text: "Continue", onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    );
  });
}

function offerSettings(): Promise<void> {
  return new Promise((resolve) => {
    Alert.alert(
      "Bluetooth blocked",
      "Permission was denied earlier. Open Settings and allow Bluetooth (and nearby devices) for DOUBLE A POS.",
      [
        { text: "Cancel", style: "cancel", onPress: () => resolve() },
        {
          text: "Open Settings",
          onPress: () => {
            void Linking.openSettings().finally(() => resolve());
          },
        },
      ],
      { cancelable: true, onDismiss: () => resolve() },
    );
  });
}
