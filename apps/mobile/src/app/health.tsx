import { useCallback, useState } from "react";
import { Linking, Platform, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { describeHealthConnection, newExternalWorkouts, type HealthConnectionSummary } from "@vitacore/domain";
import { AppText, Button, Card, Screen } from "@/components/ui";
import {
  checkPlatformHealth,
  connectPlatformHealth,
  getHealthPermissionStatus,
  openPlatformHealthSettings,
  readActiveEnergy,
  readDistance,
  readHeartRateVariability,
  readRecentWorkouts,
  readRestingHeartRate,
  readSleep,
  readSteps,
  type ActiveEnergyReading,
  type DistanceReading,
  type ExternalWorkoutSample,
  type HealthConnection,
  type HeartRateReading,
  type HrvReading,
  type SleepReading,
  type StepReading,
} from "@/health";
import { listActivities, listWorkouts } from "@/data/logs";
import { readPreference, writePreference } from "@/data/db";
import { copy } from "@/i18n/copy";
import { useTheme } from "@/design/theme";
import { space } from "@/design/tokens";

const LAST_READ_KEY = "health_last_successful_read_at";

function platformFor(): "healthkit" | "health_connect" | "unsupported" {
  if (Platform.OS === "ios") return "healthkit";
  if (Platform.OS === "android") return "health_connect";
  return "unsupported";
}

function toSummary(connection: HealthConnection, lastRead: string | null): HealthConnectionSummary {
  const platform = platformFor();
  if (platform === "unsupported") return { platform, status: "unavailable", lastSuccessfulReadAt: null };
  if (connection === "unavailable") return { platform, status: "unavailable", lastSuccessfulReadAt: null };
  if (connection === "denied") {
    // Android's Health Connect reports a real denial; iOS's requestAuthorization resolving false
    // means the system sheet was dismissed without granting anything it could ask for right now —
    // whether any individual item was actually denied is never reported back on iOS (see health.md).
    return { platform, status: platform === "health_connect" ? "denied" : "unknown", lastSuccessfulReadAt: lastRead };
  }
  if (connection === "ready") return { platform, status: platform === "healthkit" ? "unknown" : "granted", lastSuccessfulReadAt: lastRead };
  return { platform, status: "unknown", lastSuccessfulReadAt: lastRead };
}

const ANDROID_WEARABLE_PATHS: { name: string; status: string }[] = [
  {
    name: "Samsung Galaxy Watch / Samsung Health",
    status: "Connect Samsung Health to Health Connect in the phone's settings or Samsung Health settings, if available. Then grant VitaCore access here. We will only show metrics Samsung Health actually shares.",
  },
  {
    name: "Fitbit / Google Pixel Watch",
    status: "VitaCore can read only records that a supported companion app shares with Health Connect. Direct Google Health API access is not currently available to new projects, so a direct Fitbit cloud connection is not enabled.",
  },
  {
    name: "Noise / boAt / other watch brands",
    status: "Compatibility depends on the companion app. If it can write records to Health Connect, VitaCore can read the supported record types after you grant permission. If it cannot share data, this route will not work for that device yet.",
  },
  {
    name: "Garmin",
    status: "Health Connect is the first route to check. A separate direct Garmin Connect integration is planned, but it requires Garmin developer-program approval and is not enabled yet.",
  },
];

export default function HealthScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const [connection, setConnection] = useState<HealthConnection | "checking">("checking");
  const [lastRead, setLastRead] = useState<string | null>(null);
  const [workouts, setWorkouts] = useState<ExternalWorkoutSample[] | null>(null);
  const [workoutsNote, setWorkoutsNote] = useState<string | null>(null);
  const [steps, setSteps] = useState<StepReading | null>(null);
  const [sleep, setSleep] = useState<SleepReading | null>(null);
  const [restingHeartRate, setRestingHeartRate] = useState<HeartRateReading | null>(null);
  const [hrv, setHrv] = useState<HrvReading | null>(null);
  const [distance, setDistance] = useState<DistanceReading | null>(null);
  const [activeEnergy, setActiveEnergy] = useState<ActiveEnergyReading | null>(null);
  const [busy, setBusy] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      void Promise.all([checkPlatformHealth(), readPreference(LAST_READ_KEY)]).then(async ([status, timestamp]) => {
        if (!active) return;
        setConnection(status);
        setLastRead(timestamp);
        if (status === "ready") {
          await Promise.all([loadPlatformReadings(), loadExternalWorkouts()]);
        }
      }).catch(() => {
        if (active) setConnection("unavailable");
      });
      return () => {
        active = false;
      };
    }, []),
  );

  async function connect() {
    setBusy(true);
    try {
      const result = await connectPlatformHealth();
      setConnection(result);
      if (result === "ready") {
        // Record a successful read only after an actual query returns value/empty,
        // not merely because the permission sheet was closed.
        const steps = await readSteps();
        if (steps.status !== "unavailable") {
          const now = new Date().toISOString();
          await writePreference(LAST_READ_KEY, now);
          setLastRead(now);
        }
        await Promise.all([loadPlatformReadings(), loadExternalWorkouts()]);
        setConnection(await checkPlatformHealth());
      }
    } catch {
      setWorkoutsNote("Health data could not be refreshed. Check Health Connect permissions and try again.");
      setConnection(await checkPlatformHealth());
    } finally {
      setBusy(false);
    }
  }

  async function loadPlatformReadings() {
    const [stepReading, sleepReading, heartRateReading, hrvReading, distanceReading, energyReading] = await Promise.all([
      readSteps(), readSleep(), readRestingHeartRate(), readHeartRateVariability(), readDistance(), readActiveEnergy(),
    ]);
    setSteps(stepReading);
    setSleep(sleepReading);
    setRestingHeartRate(heartRateReading);
    setHrv(hrvReading);
    setDistance(distanceReading);
    setActiveEnergy(energyReading);
  }

  async function loadExternalWorkouts() {
    const reading = await readRecentWorkouts();
    if (reading.status !== "value") {
      setWorkouts([]);
      setWorkoutsNote(reading.status === "empty" ? reading.detail : reading.detail);
      return;
    }
    const [manualWorkouts, activities] = await Promise.all([listWorkouts(), listActivities()]);
    const localSessions = [
      ...manualWorkouts.map((session) => ({ startedAt: session.started_at, endedAt: session.ended_at })),
      // activity_sessions' ended_at is not selected by listActivities; the null default below
      // covers these with the same rough one-hour window isWorkoutAlreadyRepresented uses for
      // any still-open session, which is an approximation, not the activity's real duration.
      ...activities.map((session) => ({ startedAt: session.started_at, endedAt: null as string | null })),
    ];
    const fresh = newExternalWorkouts(
      reading.workouts.map((workout) => ({ ...workout, source: platformFor() === "healthkit" ? "healthkit" : "health_connect" })),
      localSessions,
    );
    setWorkouts(fresh);
    setWorkoutsNote(
      fresh.length === 0
        ? "Every recent workout from Health matches something already logged in VitaCore, so nothing new is shown."
        : null,
    );
  }

  const summary = connection === "checking" ? null : toSummary(connection, lastRead);
  const platform = platformFor();

  return (
    <Screen>
      <AppText variant="h1">Health & Devices</AppText>
      <AppText variant="small" color={colors.textSecondary}>
        {platform === "unsupported"
          ? "Health data connections are not available in this preview."
          : "VitaCore reads from the platform health store on your phone. Nothing here is invented if a permission is off or a device isn't connected."}
      </AppText>
      <View style={{ height: space.lg }} />

      <Card>
        <AppText variant="label">{platform === "healthkit" ? "Apple Health" : platform === "health_connect" ? "Health Connect" : "Health data"}</AppText>
        <AppText variant="small" color={colors.textSecondary}>
          {summary ? describeHealthConnection(summary) : "Checking…"}
        </AppText>
        {platform !== "unsupported" ? (
          <>
            <View style={{ height: space.md }} />
            <Button label={busy ? "Working…" : "Connect / review access"} onPress={() => void connect()} disabled={busy} />
            {platform === "health_connect" ? (
              <>
                <View style={{ height: space.sm }} />
                <Button
                  label="Open Health Connect settings"
                  tone="secondary"
                  onPress={() => {
                    void openPlatformHealthSettings();
                    void getHealthPermissionStatus().then((status) => setConnection(status.status));
                  }}
                />
                <View style={{ height: space.sm }} />
                <Button
                  label="Required permissions checklist"
                  tone="ghost"
                  onPress={() => router.push("/health-setup" as Parameters<typeof router.push>[0])}
                />
                <AppText variant="caption" color={colors.textSecondary}>
                  VitaCore needs every Health Connect permission. Partial access is treated as incomplete.
                </AppText>
              </>
            ) : null}
            {platform === "healthkit" ? (
              <>
                <View style={{ height: space.sm }} />
                <Button label="Open Settings > Privacy > Health" tone="ghost" onPress={() => void Linking.openSettings()} />
              </>
            ) : null}
          </>
        ) : null}
      </Card>

      <View style={{ height: space.lg }} />
      <AppText variant="label">{platform === "health_connect" ? "Today's Android health data" : "Today's health data"}</AppText>
      <Card>
        <AppText variant="small">Steps</AppText>
        <AppText variant="h2">{steps?.status === "value" ? steps.steps.toLocaleString("en-US") : steps?.status === "empty" ? "No steps recorded" : steps?.status === "unavailable" ? "Unavailable" : "Checking…"}</AppText>
        {steps && steps.status !== "value" ? <AppText variant="caption" color={colors.textSecondary}>{steps.detail}</AppText> : null}
        {steps?.status === "value" ? <AppText variant="caption" color={colors.textSecondary}>{steps.sourceLabel}</AppText> : null}
        <View style={{ height: space.md }} />
        <AppText variant="small">Sleep last night</AppText>
        <AppText variant="h2">{sleep?.status === "value" ? (Math.floor(sleep.asleepMinutes / 60) + "h " + (sleep.asleepMinutes % 60) + "m") : sleep?.status === "empty" ? "No sleep recorded" : sleep?.status === "unavailable" ? "Unavailable" : "Checking…"}</AppText>
        {sleep && sleep.status !== "value" ? <AppText variant="caption" color={colors.textSecondary}>{sleep.detail}</AppText> : null}
        {sleep?.status === "value" ? <AppText variant="caption" color={colors.textSecondary}>{sleep.stages ? "Sleep stages available" : "Sleep stages not provided by source"}{sleep.inBedMinutes == null ? "" : " · In bed " + Math.floor(sleep.inBedMinutes / 60) + "h " + (sleep.inBedMinutes % 60) + "m"}</AppText> : null}
        <View style={{ height: space.md }} />
        <AppText variant="small">Resting heart rate</AppText>
        <AppText variant="h2">{restingHeartRate?.status === "value" ? (restingHeartRate.restingBpm + " bpm") : restingHeartRate?.status === "empty" ? "No reading recorded" : restingHeartRate?.status === "unavailable" ? "Unavailable" : "Checking…"}</AppText>
        {restingHeartRate && restingHeartRate.status !== "value" ? <AppText variant="caption" color={colors.textSecondary}>{restingHeartRate.detail}</AppText> : null}
        {restingHeartRate?.status === "value" ? <AppText variant="caption" color={colors.textSecondary}>{restingHeartRate.baselineBpm == null ? "28-day baseline needs more data" : "28-day baseline " + restingHeartRate.baselineBpm + " bpm"}</AppText> : null}
        <View style={{ height: space.md }} />
        <AppText variant="small">Heart-rate variability (HRV)</AppText>
        <AppText variant="h2">{hrv?.status === "value" ? (hrv.valueMs + " ms") : hrv?.status === "empty" ? "No reading recorded" : hrv?.status === "unavailable" ? "Unavailable" : "Checking…"}</AppText>
        {hrv && hrv.status !== "value" ? <AppText variant="caption" color={colors.textSecondary}>{hrv.detail}</AppText> : null}
        {hrv?.status === "value" ? <AppText variant="caption" color={colors.textSecondary}>{hrv.baselineMs == null ? "28-day baseline needs more data" : "28-day baseline " + hrv.baselineMs + " ms"}{hrv.sourceLabel.includes("RMSSD") ? " · RMSSD" : ""}</AppText> : null}
        <View style={{ height: space.md }} />
        <AppText variant="small">Walking and running distance</AppText>
        <AppText variant="h2">{distance?.status === "value" ? (distance.meters >= 1000 ? `${(distance.meters / 1000).toFixed(2)} km` : `${distance.meters} m`) : distance?.status === "empty" ? "No distance recorded" : distance?.status === "unavailable" ? "Unavailable" : "Checking…"}</AppText>
        {distance && distance.status !== "value" ? <AppText variant="caption" color={colors.textSecondary}>{distance.detail}</AppText> : null}
        <View style={{ height: space.md }} />
        <AppText variant="small">Active calories burned</AppText>
        <AppText variant="h2">{activeEnergy?.status === "value" ? `${activeEnergy.kcal.toLocaleString("en-US")} kcal` : activeEnergy?.status === "empty" ? "No active calories recorded" : activeEnergy?.status === "unavailable" ? "Unavailable" : "Checking…"}</AppText>
        {activeEnergy && activeEnergy.status !== "value" ? <AppText variant="caption" color={colors.textSecondary}>{activeEnergy.detail}</AppText> : null}
        <View style={{ height: space.md }} />
        <Button label="Refresh health data" tone="secondary" onPress={() => void Promise.all([loadPlatformReadings(), loadExternalWorkouts()])} disabled={busy} />
      </Card>

      <View style={{ height: space.lg }} />
      <AppText variant="label">Recent workouts from Health</AppText>
      <AppText variant="caption" color={colors.textSecondary}>Read-only. A workout you also logged in VitaCore is not shown twice.</AppText>
      <View style={{ height: space.sm }} />
      {workouts === null ? (
        <AppText variant="small" color={colors.textSecondary}>Connect above to check for recent workouts.</AppText>
      ) : workoutsNote ? (
        <AppText variant="small" color={colors.textSecondary}>{workoutsNote}</AppText>
      ) : (
        workouts.map((workout, index) => (
          <View key={workout.sourceRecordId ?? index} style={{ paddingVertical: 6 }}>
            <AppText variant="small">{workout.kind} · {new Date(workout.startedAt).toLocaleString()}</AppText>
          </View>
        ))
      )}

      <View style={{ height: space.xl }} />
      <AppText variant="label">{platform === "health_connect" ? "Android wearable compatibility" : "Wearables"}</AppText>
      <AppText variant="caption" color={colors.textSecondary}>
        {platform === "health_connect"
          ? "First, connect your watch to its companion app and check whether that app shares data with Health Connect. Then connect Health Connect above. These are compatibility routes, not claims that each brand is directly connected."
          : "iPhone support is being handled separately in a later phase."}
      </AppText>
      <View style={{ height: space.sm }} />
      {(platform === "health_connect" ? ANDROID_WEARABLE_PATHS : [
        { name: "Apple Health", status: "iPhone integration is deferred while we focus on Android first." },
        { name: "Direct brand connections", status: "Provider-specific connections will be added when developer access and secure server-side OAuth are ready." },
      ]).map((item) => (
        <Card key={item.name} style={{ marginBottom: space.sm }}>
          <AppText variant="small">{item.name}</AppText>
          <AppText variant="caption" color={colors.textSecondary}>{item.status}</AppText>
        </Card>
      ))}
      <AppText variant="caption" color={colors.textSecondary}>{copy.wearableBridge}</AppText>

      <View style={{ height: space.lg }} />
      <Button label="Back" tone="ghost" onPress={() => router.back()} />
    </Screen>
  );
}
