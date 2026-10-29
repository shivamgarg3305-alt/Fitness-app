/**
 * Required Android Health Connect read permissions for VitaCore.
 * The Android app refuses to proceed until every listed type is granted.
 * Apple HealthKit support for the same product surface is planned separately.
 */

export const REQUIRED_HEALTH_CONNECT_READ_TYPES = [
  "Steps",
  "Distance",
  "ActiveCaloriesBurned",
  "SleepSession",
  "HeartRate",
  "RestingHeartRate",
  "HeartRateVariabilityRmssd",
  "ExerciseSession",
] as const;

export type RequiredHealthConnectReadType = (typeof REQUIRED_HEALTH_CONNECT_READ_TYPES)[number];

export const HEALTH_CONNECT_PERMISSION_LABELS: Record<RequiredHealthConnectReadType, string> = {
  Steps: "Steps",
  Distance: "Distance",
  ActiveCaloriesBurned: "Active calories",
  SleepSession: "Sleep",
  HeartRate: "Heart rate",
  RestingHeartRate: "Resting heart rate",
  HeartRateVariabilityRmssd: "Heart-rate variability",
  ExerciseSession: "Workouts / exercise",
};

export type HealthConnectPermissionGrant = {
  accessType: string;
  recordType: string;
};

/**
 * Returns missing required read types. Empty array means every required type is granted.
 * Unknown / extra grants are ignored — only the required set matters.
 */
export function missingHealthConnectPermissions(
  granted: HealthConnectPermissionGrant[],
  required: readonly string[] = REQUIRED_HEALTH_CONNECT_READ_TYPES,
): string[] {
  const reads = new Set(
    granted
      .filter((item) => item.accessType === "read")
      .map((item) => item.recordType),
  );
  return required.filter((type) => !reads.has(type));
}

export function areAllHealthConnectPermissionsGranted(
  granted: HealthConnectPermissionGrant[],
  required: readonly string[] = REQUIRED_HEALTH_CONNECT_READ_TYPES,
): boolean {
  return missingHealthConnectPermissions(granted, required).length === 0;
}

export type HealthGateDecision =
  | { action: "proceed" }
  | { action: "require_health_setup"; reason: string }
  | { action: "platform_unsupported"; reason: string };

/**
 * Pure routing decision for the entry gate.
 * Android requires a complete Health Connect grant before onboarding/home.
 * Non-Android platforms are marked unsupported for the health-gated product path
 * (manual logging may still exist behind a separate preview path at the caller's choice).
 */
export function decideHealthGate(input: {
  platform: "android" | "ios" | "web" | "other";
  /** Android only: whether every required Health Connect read is granted. */
  androidAllGranted: boolean | null;
}): HealthGateDecision {
  if (input.platform === "android") {
    if (input.androidAllGranted === true) return { action: "proceed" };
    if (input.androidAllGranted === false) {
      return {
        action: "require_health_setup",
        reason: "VitaCore needs every listed Health Connect permission before it can start.",
      };
    }
    return {
      action: "require_health_setup",
      reason: "Checking Health Connect permissions.",
    };
  }
  return {
    action: "platform_unsupported",
    reason:
      input.platform === "ios"
        ? "This VitaCore release is built around Android Health Connect. Apple Health support is planned for a later release."
        : "Health Connect only runs in the Android app. This preview cannot complete the required health connection.",
  };
}
