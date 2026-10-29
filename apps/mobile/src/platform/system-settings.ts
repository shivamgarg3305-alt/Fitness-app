import { Linking, Platform } from "react-native";

/** Open the OS settings page for this app (permissions, notifications, etc.). */
export async function openAppSettings(): Promise<boolean> {
  try {
    await Linking.openSettings();
    return true;
  } catch {
    return false;
  }
}

/**
 * Android Health Connect settings. Uses the native module when available;
 * falls back to app settings on failure or non-Android.
 */
export async function openHealthSettings(): Promise<boolean> {
  if (Platform.OS === "ios") {
    return openAppSettings();
  }
  if (Platform.OS !== "android") {
    return false;
  }
  try {
    const { openHealthConnectSettings } = await import("react-native-health-connect");
    openHealthConnectSettings();
    return true;
  } catch {
    return openAppSettings();
  }
}
