import { useMemo } from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";
import Constants from "expo-constants";
import { brandConfig } from "@vitacore/brand";
import {
  buildReleaseChecklist,
  featureStatusTracker,
  summarizeFeatureTracker,
  summarizeReleaseChecks,
  type FeatureTrackerStatus,
  type ReleaseCheckStatus,
} from "@vitacore/domain";
import { GlassButton, GlassCard } from "@/components/glass";
import { ProfileHeader } from "@/components/profile-header";
import { AppText, Screen } from "@/components/ui";
import {
  publicMapTileStyleUrl,
  publicSupabasePublishableKey,
  publicSupabaseUrl,
} from "@/auth/public-env";
import { capabilities } from "@/platform/capabilities";
import { useTheme } from "@/design/theme";
import { space } from "@/design/tokens";

function statusColor(status: ReleaseCheckStatus | FeatureTrackerStatus, colors: ReturnType<typeof useTheme>["colors"]) {
  if (status === "ok" || status === "verified_in_automated_tests" || status === "verified_on_physical_device") {
    return colors.textSecondary;
  }
  if (status === "missing" || status === "blocked" || status === "not_started") return colors.accent;
  return colors.textMuted;
}

function featureLabel(status: FeatureTrackerStatus): string {
  switch (status) {
    case "not_started":
      return "NOT STARTED";
    case "in_progress":
      return "IN PROGRESS";
    case "implemented_not_verified":
      return "IMPLEMENTED — NOT VERIFIED";
    case "verified_in_automated_tests":
      return "VERIFIED IN AUTOMATED TESTS";
    case "verified_on_physical_device":
      return "VERIFIED ON PHYSICAL DEVICE";
    case "blocked":
      return "BLOCKED";
  }
}

export default function ReadinessScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const env = useMemo(
    () => ({
      supabaseUrl: publicSupabaseUrl,
      supabasePublishableKey: publicSupabasePublishableKey,
      mapTileStyleUrl: publicMapTileStyleUrl || null,
    }),
    [],
  );
  const checks = useMemo(
    () =>
      buildReleaseChecklist({
        env,
        identity: {
          name: brandConfig.name,
          version: brandConfig.version,
          scheme: brandConfig.scheme,
          iosBundleIdentifier: brandConfig.iosBundleIdentifier,
          androidPackage: brandConfig.androidPackage,
        },
      }),
    [env],
  );
  const features = useMemo(() => featureStatusTracker(env), [env]);
  const summary = summarizeReleaseChecks(checks);
  const featureSummary = summarizeFeatureTracker(features);
  const surface = Constants.platform?.ios ? "ios" : Constants.platform?.android ? "android" : "web-preview";

  return (
    <Screen>
      <GlassButton label="Back" tone="ghost" onPress={() => router.back()} />
      <ProfileHeader title="Release readiness" eyebrow="Milestone 6 audit" />
      <View style={{ height: space.sm }} />
      <AppText variant="small" color={colors.textSecondary}>
        Honest status for store builds. Automated-test verification is not the same as a phone test. Nothing here claims App Store or Play readiness.
      </AppText>
      <View style={{ height: space.md }} />
      <GlassCard>
        <AppText variant="label">This surface</AppText>
        <AppText variant="h3">{surface}</AppText>
        <AppText variant="caption" color={colors.textMuted}>
          HealthKit {capabilities.healthKit ? "flag on" : "off"} · Health Connect {capabilities.healthConnect ? "flag on" : "off"} · GPS{" "}
          {capabilities.backgroundLocation ? "flag on" : "off"} · Notifications {capabilities.localNotifications ? "flag on" : "off"}
        </AppText>
        <View style={{ height: space.sm }} />
        <AppText variant="small">
          Config: {summary.ok} ok · {summary.missing} missing · {summary.blocked} blocked · {summary.unverified} unverified
        </AppText>
        <AppText variant="small">
          Features: {featureSummary.verified_in_automated_tests} auto-tested · {featureSummary.implemented_not_verified} coded ·{" "}
          {featureSummary.blocked} blocked · {featureSummary.not_started} not started · {featureSummary.verified_on_physical_device} device
        </AppText>
      </GlassCard>
      <View style={{ height: space.lg }} />
      <AppText variant="label">Config & blockers</AppText>
      <View style={{ height: space.sm }} />
      {checks.map((check) => (
        <GlassCard key={check.id} style={{ marginBottom: space.sm }}>
          <AppText variant="label" color={statusColor(check.status, colors)}>
            {check.status.toUpperCase()}
          </AppText>
          <AppText variant="h3">{check.label}</AppText>
          <AppText variant="small" color={colors.textSecondary}>
            {check.detail}
          </AppText>
        </GlassCard>
      ))}
      <View style={{ height: space.lg }} />
      <AppText variant="label">Feature tracker</AppText>
      <View style={{ height: space.sm }} />
      {features.map((item) => (
        <GlassCard key={item.id} style={{ marginBottom: space.sm }}>
          <AppText variant="label" color={statusColor(item.status, colors)}>
            {featureLabel(item.status)}
          </AppText>
          <AppText variant="h3">{item.label}</AppText>
          <AppText variant="small" color={colors.textSecondary}>
            {item.evidence}
          </AppText>
        </GlassCard>
      ))}
      <View style={{ height: space.md }} />
      <AppText variant="caption" color={colors.textMuted}>
        Full write-up: docs/RELEASE_AUDIT.md. Device checklist: docs/release-readiness.md.
      </AppText>
    </Screen>
  );
}
