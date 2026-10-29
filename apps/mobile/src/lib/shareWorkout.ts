import { Share, Platform } from "react-native";

/** Shares a text workout card suitable for Stories / messages. No paid share SDK. */
export async function shareWorkoutText(message: string): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    const result = await Share.share(
      Platform.OS === "ios" ? { message } : { message, title: "VitaCore workout" },
    );
    if (result.action === Share.dismissedAction) {
      return { ok: false, message: "Share was dismissed." };
    }
    return { ok: true };
  } catch (reason) {
    return {
      ok: false,
      message: reason instanceof Error ? reason.message : "This device could not open the share sheet.",
    };
  }
}
