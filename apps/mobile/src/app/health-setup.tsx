import { useCallback, useState } from "react";
import { AppState, Image, Platform, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { brandConfig } from "@vitacore/brand";
import {
  HEALTH_CONNECT_PERMISSION_LABELS,
  REQUIRED_HEALTH_CONNECT_READ_TYPES,
  decideHealthGate,
  type RequiredHealthConnectReadType,
} from "@vitacore/domain";
import { AppText, Button, Card, LoadingState, Screen } from "@/components/ui";
import { useAppState } from "@/data/app-state";
import { useTheme } from "@/design/theme";
import { space } from "@/design/tokens";
import {
  connectPlatformHealth,
  getHealthPermissionStatus,
  openPlatformHealthSettings,
  type HealthPermissionStatus,
} from "@/health";

function platformKind(): "android" | "ios" | "web" | "other" {
  if (Platform.OS === "android") return "android";
  if (Platform.OS === "ios") return "ios";
  if (Platform.OS === "web") return "web";
  return "other";
}

export default function HealthSetupScreen() {
  const router = useRouter();
  const { profile } = useAppState();
  const { colors } = useTheme();
  const [status, setStatus] = useState<HealthPermissionStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const next = await getHealthPermissionStatus();
    setStatus(next);
    if (next.allGranted) {
      const onboarded = Boolean(profile?.onboardingCompletedAt);
      router.replace((onboarded ? "/" : "/onboarding") as Parameters<typeof router.replace>[0]);
    }
  }, [profile?.onboardingCompletedAt, router]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      void refresh().finally(() => {
        void cancelled;
      });
      const sub = AppState.addEventListener("change", (state) => {
        if (state === "active" && !cancelled) void refresh();
      });
      return () => {
        cancelled = true;
        sub.remove();
      };
    }, [refresh]),
  );

  const gate = decideHealthGate({
    platform: platformKind(),
    androidAllGranted: status?.allGranted ?? null,
  });

  async function connect() {
    setBusy(true);
    setMessage(null);
    try {
      const result = await connectPlatformHealth();
      await refresh();
      if (result === "ready") {
        setMessage(null);
      } else if (result === "unavailable") {
        setMessage(status?.detail ?? "Health Connect is not available on this device.");
      } else {
        setMessage(
          "Every permission below must stay on. In the Health Connect sheet, allow all VitaCore reads, then return here.",
        );
      }
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : "Health Connect could not be opened.");
    } finally {
      setBusy(false);
    }
  }

  if (!status) {
    return (
      <Screen>
        <LoadingState label="Starting VitaCore…" />
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={{ alignItems: "center", gap: space.md, paddingTop: space.xl }}>
        <Image
          source={require("../../assets/images/splash-icon.png")}
          accessibilityLabel={`${brandConfig.name} logo`}
          style={{ width: 96, height: 96, borderRadius: 24 }}
        />
        <AppText variant="display">{brandConfig.name}</AppText>
        <AppText variant="body" color={colors.textSecondary} style={{ textAlign: "center" }}>
          Sleep, recovery, training, and nutrition — powered by the health data on this phone.
        </AppText>
      </View>

      <View style={{ height: space.xl }} />

      {gate.action === "platform_unsupported" ? (
        <Card>
          <AppText variant="h2">Android Health Connect required</AppText>
          <View style={{ height: space.sm }} />
          <AppText variant="small" color={colors.textSecondary}>{gate.reason}</AppText>
          <View style={{ height: space.md }} />
          <AppText variant="caption">
            Install VitaCore on an Android device with Health Connect, grant every permission listed for VitaCore, then open the app again.
          </AppText>
          {Platform.OS === "web" ? (
            <>
              <View style={{ height: space.lg }} />
              <AppText variant="caption" color={colors.textSecondary}>
                Browser preview only: health metrics stay unavailable. This is not a skip for the Android app.
              </AppText>
              <View style={{ height: space.sm }} />
              <Button
                label="Open browser preview"
                tone="secondary"
                onPress={() => {
                  const onboarded = Boolean(profile?.onboardingCompletedAt);
                  router.replace((onboarded ? "/" : "/onboarding") as Parameters<typeof router.replace>[0]);
                }}
              />
            </>
          ) : null}
        </Card>
      ) : (
        <>
          <Card>
            <AppText variant="h2">Connect Health Connect</AppText>
            <View style={{ height: space.sm }} />
            <AppText variant="small" color={colors.textSecondary}>
              VitaCore cannot start until every permission below is allowed. There is no skip — without Health Connect the app has no health source.
            </AppText>
            <View style={{ height: space.md }} />
            {REQUIRED_HEALTH_CONNECT_READ_TYPES.map((type) => {
              const granted = status.grantedTypes.includes(type);
              const label = HEALTH_CONNECT_PERMISSION_LABELS[type as RequiredHealthConnectReadType] ?? type;
              return (
                <View
                  key={type}
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    paddingVertical: space.xs,
                    borderBottomWidth: 1,
                    borderBottomColor: colors.border,
                  }}
                >
                  <AppText variant="small">{label}</AppText>
                  <AppText variant="caption" color={granted ? colors.success : colors.accent}>
                    {granted ? "Allowed" : "Required"}
                  </AppText>
                </View>
              );
            })}
            {status.detail ? (
              <>
                <View style={{ height: space.md }} />
                <AppText variant="caption" color={colors.accent}>{status.detail}</AppText>
              </>
            ) : null}
            {message ? (
              <>
                <View style={{ height: space.sm }} />
                <AppText variant="small" color={colors.accent}>{message}</AppText>
              </>
            ) : null}
          </Card>
          <View style={{ height: space.lg }} />
          <Button
            label={busy ? "Opening Health Connect…" : status.allGranted ? "Continue" : "Allow all Health Connect access"}
            onPress={() => void connect()}
            disabled={busy}
          />
          <View style={{ height: space.sm }} />
          <Button
            label="Open Health Connect settings"
            tone="secondary"
            onPress={() => {
              void openPlatformHealthSettings().then(() => refresh());
            }}
            disabled={busy}
          />
          <View style={{ height: space.sm }} />
          <Button label="I allowed everything — check again" tone="ghost" onPress={() => void refresh()} disabled={busy} />
          <View style={{ height: space.md }} />
          <AppText variant="caption" color={colors.textSecondary}>
            If any toggle stays off, VitaCore will stay on this screen. After all are allowed, you will set up your profile.
          </AppText>
        </>
      )}
    </Screen>
  );
}
