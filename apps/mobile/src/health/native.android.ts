/** Android development and release builds. Health metrics are read from Health Connect; missing records stay explicitly empty/unavailable. */
import {
  REQUIRED_HEALTH_CONNECT_READ_TYPES,
  addDays,
  aggregatePlatformSleep,
  deviceTimeZone,
  localDay,
  missingHealthConnectPermissions,
  platformSleepQueryBounds,
  zonedDayBounds,
  type PlatformSleepInterval,
} from "@vitacore/domain";
import {
  aggregateRecord,
  getGrantedPermissions,
  getSdkStatus,
  initialize,
  openHealthConnectSettings,
  readRecords,
  requestPermission,
  SleepStageType,
  SdkAvailabilityStatus,
} from "react-native-health-connect";
import type {
  ActiveEnergyReading,
  DistanceReading,
  HealthConnection,
  HealthPermissionStatus,
  HeartRateReading,
  HrvReading,
  SleepReading,
  StepReading,
  WorkoutsReading,
} from "./types";

const PERMISSIONS = REQUIRED_HEALTH_CONNECT_READ_TYPES.map((recordType) => ({
  accessType: "read" as const,
  recordType,
}));

function todayIsoRange(): { startTime: string; endTime: string } {
  const zone = deviceTimeZone();
  const bounds = zonedDayBounds(localDay(new Date(), zone), zone);
  return { startTime: bounds.start.toISOString(), endTime: bounds.end.toISOString() };
}

const BASELINE_WINDOW_DAYS = 28;

/** The 28 days before today. Excludes today so a baseline never includes the value it is compared against. */
function baselineIsoRange(): { startTime: string; endTime: string } {
  const zone = deviceTimeZone();
  const today = localDay(new Date(), zone);
  const end = zonedDayBounds(today, zone).start;
  const start = zonedDayBounds(addDays(today, -BASELINE_WINDOW_DAYS), zone).start;
  return { startTime: start.toISOString(), endTime: end.toISOString() };
}

export async function getHealthPermissionStatus(): Promise<HealthPermissionStatus> {
  try {
    const sdk = await getSdkStatus();
    if (sdk !== SdkAvailabilityStatus.SDK_AVAILABLE) {
      return {
        status: "unavailable",
        allGranted: false,
        grantedTypes: [],
        missingTypes: [...REQUIRED_HEALTH_CONNECT_READ_TYPES],
        detail:
          sdk === SdkAvailabilityStatus.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED
            ? "Health Connect needs to be installed or updated from the Play Store before VitaCore can start."
            : "Health Connect is not available on this Android device.",
      };
    }
    const ready = await initialize();
    if (!ready) {
      return {
        status: "unavailable",
        allGranted: false,
        grantedTypes: [],
        missingTypes: [...REQUIRED_HEALTH_CONNECT_READ_TYPES],
        detail: "Health Connect could not be initialized on this device.",
      };
    }
    const granted = await getGrantedPermissions();
    const missing = missingHealthConnectPermissions(granted);
    const grantedTypes = REQUIRED_HEALTH_CONNECT_READ_TYPES.filter((type) => !missing.includes(type));
    if (missing.length === 0) {
      return { status: "ready", allGranted: true, grantedTypes: [...grantedTypes], missingTypes: [], detail: null };
    }
    return {
      status: "denied",
      allGranted: false,
      grantedTypes: [...grantedTypes],
      missingTypes: missing,
      detail: "Every listed Health Connect permission is required. Turn them all on, then return to VitaCore.",
    };
  } catch (error) {
    return {
      status: "unavailable",
      allGranted: false,
      grantedTypes: [],
      missingTypes: [...REQUIRED_HEALTH_CONNECT_READ_TYPES],
      detail: error instanceof Error ? error.message : "Health Connect permissions could not be read.",
    };
  }
}

export async function checkPlatformHealth(): Promise<HealthConnection> {
  const status = await getHealthPermissionStatus();
  return status.status;
}

/**
 * Opens the Health Connect permission sheet and requires every listed read type.
 * A partial grant is treated as denied — the app does not start until all are on.
 */
export async function connectPlatformHealth(): Promise<HealthConnection> {
  try {
    const before = await getHealthPermissionStatus();
    if (before.status === "unavailable") return "unavailable";
    const ready = await initialize();
    if (!ready) return "unavailable";
    await requestPermission(PERMISSIONS);
    // Re-read grants from the OS rather than trusting the request return value alone.
    const after = await getHealthPermissionStatus();
    return after.allGranted ? "ready" : after.status === "unavailable" ? "unavailable" : "denied";
  } catch {
    return "unavailable";
  }
}

export async function openPlatformHealthSettings(): Promise<void> {
  openHealthConnectSettings();
}

export async function readSteps(): Promise<StepReading> {
  const range = todayIsoRange();
  try {
    const ready = await initialize();
    if (!ready) {
      return { status: "unavailable", detail: "Health Connect is not available on this Android device." };
    }
    // Health Connect aggregation applies the user's source priority and avoids
    // double-counting overlapping step records from the phone and multiple wearables.
    const result = await aggregateRecord({
      recordType: "Steps",
      timeRangeFilter: { operator: "between", startTime: range.startTime, endTime: range.endTime },
    });
    const steps = result.COUNT_TOTAL ?? 0;
    if (steps <= 0) {
      return { status: "empty", sourceLabel: "Health Connect", detail: "Health Connect has no step records for today. Connect a step source such as your phone or wearable to Health Connect." };
    }
    return { status: "value", steps, source: "health_connect", sourceLabel: "Steps · Health Connect (aggregated)" };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Steps could not be read from Health Connect.";
    return { status: "unavailable", detail: message };
  }
}

/**
 * Health Connect's STAGE_TYPE_AWAKE_IN_BED is 7. react-native-health-connect@4.1.3's
 * SleepStageType constant omits it, so the numeric value is kept here.
 */
const STAGE_AWAKE_IN_BED = 7;

export async function readSleep(): Promise<SleepReading> {
  try {
    const ready = await initialize();
    if (!ready) {
      return { status: "unavailable", detail: "Health Connect is not available on this Android device." };
    }
    const zone = deviceTimeZone();
    const { start, end } = platformSleepQueryBounds(new Date(), zone);
    const page = await readRecords("SleepSession", {
      timeRangeFilter: { operator: "between", startTime: start.toISOString(), endTime: end.toISOString() },
    });
    if (page.records.length === 0) {
      return { status: "empty", sourceLabel: "Health Connect", detail: "Health Connect has no sleep session for last night." };
    }
    const intervals: PlatformSleepInterval[] = [];
    for (const record of page.records) {
      const sessionStart = new Date(record.startTime).getTime();
      const sessionEnd = new Date(record.endTime).getTime();
      // Session envelope is in-bed only. Without stages we do NOT invent asleep minutes.
      intervals.push({ startMs: sessionStart, endMs: sessionEnd, kind: "in_bed" });
      for (const stage of record.stages ?? []) {
        const startMs = new Date(stage.startTime).getTime();
        const endMs = new Date(stage.endTime).getTime();
        if (stage.stage === SleepStageType.AWAKE || stage.stage === STAGE_AWAKE_IN_BED || stage.stage === SleepStageType.OUT_OF_BED) {
          intervals.push({ startMs, endMs, kind: "awake" });
        }
        if (stage.stage === SleepStageType.LIGHT || stage.stage === SleepStageType.SLEEPING) {
          intervals.push({ startMs, endMs, kind: "light" });
        }
        if (stage.stage === SleepStageType.DEEP) intervals.push({ startMs, endMs, kind: "deep" });
        if (stage.stage === SleepStageType.REM) intervals.push({ startMs, endMs, kind: "rem" });
      }
    }
    const aggregated = aggregatePlatformSleep({ intervals, now: new Date(), timeZone: zone });
    if (aggregated.status === "empty") {
      return { status: "empty", sourceLabel: "Health Connect", detail: aggregated.reason };
    }
    return {
      status: "value",
      sourceLabel: "Sleep · Health Connect",
      asleepMinutes: aggregated.asleepMinutes,
      inBedMinutes: aggregated.inBedMinutes,
      stages: aggregated.stages,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Sleep could not be read from Health Connect.";
    return { status: "unavailable", detail: message };
  }
}

export async function readRestingHeartRate(): Promise<HeartRateReading> {
  try {
    const ready = await initialize();
    if (!ready) return { status: "unavailable", detail: "Health Connect is not available on this Android device." };
    const range = todayIsoRange();
    const page = await readRecords("RestingHeartRate", {
      timeRangeFilter: { operator: "between", startTime: range.startTime, endTime: range.endTime },
    });
    const todayRecords = page.records;
    if (todayRecords.length === 0) {
      return { status: "empty", sourceLabel: "Health Connect", detail: "Health Connect has no resting heart rate for today." };
    }
    const todayAvg = todayRecords.reduce((sum, record) => sum + record.beatsPerMinute, 0) / todayRecords.length;

    const baseline = baselineIsoRange();
    const baselinePage = await readRecords("RestingHeartRate", {
      timeRangeFilter: { operator: "between", startTime: baseline.startTime, endTime: baseline.endTime },
    });
    const baselineRecords = baselinePage.records;
    const baselineAvg = baselineRecords.length
      ? baselineRecords.reduce((sum, record) => sum + record.beatsPerMinute, 0) / baselineRecords.length
      : null;

    return {
      status: "value",
      restingBpm: Math.round(todayAvg),
      baselineBpm: baselineAvg == null ? null : Math.round(baselineAvg),
      sourceLabel: "Resting heart rate · Health Connect",
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Resting heart rate could not be read from Health Connect.";
    return { status: "unavailable", detail: message };
  }
}

export async function readHeartRateVariability(): Promise<HrvReading> {
  try {
    const ready = await initialize();
    if (!ready) return { status: "unavailable", detail: "Health Connect is not available on this Android device." };
    const range = todayIsoRange();
    const page = await readRecords("HeartRateVariabilityRmssd", {
      timeRangeFilter: { operator: "between", startTime: range.startTime, endTime: range.endTime },
    });
    const todayRecords = page.records;
    if (todayRecords.length === 0) {
      return { status: "empty", sourceLabel: "Health Connect", detail: "Health Connect has no heart-rate variability for today." };
    }
    const todayAvg = todayRecords.reduce((sum, record) => sum + record.heartRateVariabilityMillis, 0) / todayRecords.length;

    const baseline = baselineIsoRange();
    const baselinePage = await readRecords("HeartRateVariabilityRmssd", {
      timeRangeFilter: { operator: "between", startTime: baseline.startTime, endTime: baseline.endTime },
    });
    const baselineRecords = baselinePage.records;
    const baselineAvg = baselineRecords.length
      ? baselineRecords.reduce((sum, record) => sum + record.heartRateVariabilityMillis, 0) / baselineRecords.length
      : null;

    return {
      status: "value",
      valueMs: Math.round(todayAvg),
      baselineMs: baselineAvg == null ? null : Math.round(baselineAvg),
      sourceLabel: "Heart-rate variability (RMSSD) · Health Connect",
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Heart-rate variability could not be read from Health Connect.";
    return { status: "unavailable", detail: message };
  }
}

export async function readDistance(): Promise<DistanceReading> {
  try {
    const ready = await initialize();
    if (!ready) return { status: "unavailable", detail: "Health Connect is not available on this Android device." };
    const range = todayIsoRange();
    // Use Health Connect's aggregate API for cumulative metrics so source priority
    // and its duplicate-record handling are respected.
    const result = await aggregateRecord({
      recordType: "Distance",
      timeRangeFilter: { operator: "between", startTime: range.startTime, endTime: range.endTime },
    });
    const meters = result.DISTANCE?.inMeters ?? 0;
    if (meters <= 0) return { status: "empty", sourceLabel: "Health Connect", detail: "Health Connect has no distance records for today." };
    return { status: "value", meters: Math.round(meters), sourceLabel: "Distance · Health Connect (aggregated)" };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Distance could not be read from Health Connect.";
    return { status: "unavailable", detail: message };
  }
}

export async function readActiveEnergy(): Promise<ActiveEnergyReading> {
  try {
    const ready = await initialize();
    if (!ready) return { status: "unavailable", detail: "Health Connect is not available on this Android device." };
    const range = todayIsoRange();
    const result = await aggregateRecord({
      recordType: "ActiveCaloriesBurned",
      timeRangeFilter: { operator: "between", startTime: range.startTime, endTime: range.endTime },
    });
    const kcal = result.ACTIVE_CALORIES_TOTAL?.inKilocalories ?? 0;
    if (kcal <= 0) return { status: "empty", sourceLabel: "Health Connect", detail: "Health Connect has no active-energy records for today." };
    return { status: "value", kcal: Math.round(kcal), sourceLabel: "Active energy · Health Connect (aggregated)" };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Active energy could not be read from Health Connect.";
    return { status: "unavailable", detail: message };
  }
}

export async function readRecentWorkouts(): Promise<WorkoutsReading> {
  try {
    const ready = await initialize();
    if (!ready) return { status: "unavailable", detail: "Health Connect is not available on this Android device." };
    const end = new Date();
    const start = new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);
    const page = await readRecords("ExerciseSession", {
      timeRangeFilter: { operator: "between", startTime: start.toISOString(), endTime: end.toISOString() },
    });
    const records = page.records;
    if (records.length === 0) {
      return { status: "empty", sourceLabel: "Health Connect", detail: "Health Connect has no exercise sessions from the last 7 days." };
    }
    return {
      status: "value",
      sourceLabel: "Workouts · Health Connect",
      workouts: records.map((record) => ({
        sourceRecordId: record.metadata?.id ?? null,
        kind: String(record.exerciseType ?? "exercise"),
        startedAt: record.startTime,
        endedAt: record.endTime,
      })),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Workouts could not be read from Health Connect.";
    return { status: "unavailable", detail: message };
  }
}
