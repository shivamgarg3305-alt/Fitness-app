/**
 * Manual sleep-session lifecycle helpers.
 * Distinguishes: time in bed, elapsed session duration, and actual asleep duration.
 * Never invents sleep stages from elapsed time.
 */

export type ManualSleepSessionStatus = "active" | "completed" | "cancelled";

export type ManualSleepSession = {
  id: string;
  status: ManualSleepSessionStatus;
  /** When the user tapped Start Sleep (session clock). */
  sessionStartedAt: string;
  /** When the user woke / cancelled. Null while active. */
  sessionEndedAt: string | null;
  /** Optional corrected bedtime (in bed). Null until set. */
  inBedStart: string | null;
  inBedEnd: string | null;
  /** Optional corrected asleep window. Null until set; while active, asleep is unknown. */
  asleepStart: string | null;
  asleepEnd: string | null;
  timezone: string;
  source: "manual";
};

export type SleepDurationBreakdown = {
  /** Wall-clock from Start Sleep to Wake/Cancel. */
  elapsedSessionMinutes: number | null;
  /** inBedEnd - inBedStart when both set. */
  timeInBedMinutes: number | null;
  /** asleepEnd - asleepStart when both set. Never invented from elapsed. */
  asleepMinutes: number | null;
};

function parseIso(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? ms : null;
}

function minutesBetween(startIso: string | null, endIso: string | null): number | null {
  const start = parseIso(startIso);
  const end = parseIso(endIso);
  if (start == null || end == null || end < start) return null;
  return Math.round((end - start) / 60_000);
}

export function sleepDurationBreakdown(
  session: Pick<ManualSleepSession, "sessionStartedAt" | "sessionEndedAt" | "inBedStart" | "inBedEnd" | "asleepStart" | "asleepEnd">,
  nowIso?: string,
): SleepDurationBreakdown {
  const end = session.sessionEndedAt ?? nowIso ?? null;
  return {
    elapsedSessionMinutes: minutesBetween(session.sessionStartedAt, end),
    timeInBedMinutes: minutesBetween(session.inBedStart, session.inBedEnd),
    asleepMinutes: minutesBetween(session.asleepStart, session.asleepEnd),
  };
}

export function canStartManualSleep(existingActiveId: string | null | undefined): { ok: true } | { ok: false; reason: string } {
  if (existingActiveId) {
    return { ok: false, reason: "A sleep session is already in progress. Wake or cancel it before starting another." };
  }
  return { ok: true };
}

export function startManualSleep(input: {
  id: string;
  startedAtIso: string;
  timezone: string;
}): ManualSleepSession {
  return {
    id: input.id,
    status: "active",
    sessionStartedAt: input.startedAtIso,
    sessionEndedAt: null,
    inBedStart: input.startedAtIso,
    inBedEnd: null,
    asleepStart: null,
    asleepEnd: null,
    timezone: input.timezone,
    source: "manual",
  };
}

export function wakeManualSleep(
  session: ManualSleepSession,
  endedAtIso: string,
): ManualSleepSession | { ok: false; reason: string } {
  if (session.status !== "active") return { ok: false, reason: "Only an active sleep session can be ended." };
  const startMs = parseIso(session.sessionStartedAt);
  const endMs = parseIso(endedAtIso);
  if (startMs == null || endMs == null || endMs < startMs) {
    return { ok: false, reason: "Wake time must be after the session start." };
  }
  return {
    ...session,
    status: "completed",
    sessionEndedAt: endedAtIso,
    inBedEnd: session.inBedEnd ?? endedAtIso,
    // Elapsed session is not claimed as asleep; user may correct asleep times later.
    asleepStart: session.asleepStart,
    asleepEnd: session.asleepEnd,
  };
}

export function cancelManualSleep(
  session: ManualSleepSession,
  cancelledAtIso: string,
): ManualSleepSession | { ok: false; reason: string } {
  if (session.status !== "active") return { ok: false, reason: "Only an active sleep session can be cancelled." };
  return {
    ...session,
    status: "cancelled",
    sessionEndedAt: cancelledAtIso,
    inBedEnd: session.inBedEnd ?? cancelledAtIso,
  };
}

export function applySleepTimeCorrections(
  session: ManualSleepSession,
  patch: Partial<Pick<ManualSleepSession, "inBedStart" | "inBedEnd" | "asleepStart" | "asleepEnd">>,
): ManualSleepSession | { ok: false; reason: string } {
  if (session.status === "active") {
    return { ok: false, reason: "Finish or cancel the session before correcting times." };
  }
  const next = { ...session, ...patch };
  const inBed = minutesBetween(next.inBedStart, next.inBedEnd);
  if (next.inBedStart && next.inBedEnd && inBed == null) {
    return { ok: false, reason: "In-bed end must be after in-bed start." };
  }
  const asleep = minutesBetween(next.asleepStart, next.asleepEnd);
  if (next.asleepStart && next.asleepEnd && asleep == null) {
    return { ok: false, reason: "Asleep end must be after asleep start." };
  }
  if (asleep != null && (asleep < 1 || asleep > 24 * 60)) {
    return { ok: false, reason: "Asleep duration must be between 1 minute and 24 hours." };
  }
  return next;
}

export function recoverActiveSleepSession(
  stored: ManualSleepSession | null | undefined,
): ManualSleepSession | null {
  if (!stored || stored.status !== "active") return null;
  if (!stored.sessionStartedAt || parseIso(stored.sessionStartedAt) == null) return null;
  return stored;
}

/** Smart-alarm window sizes in minutes. */
export const SMART_ALARM_WINDOWS = [15, 30, 45] as const;
export type SmartAlarmWindowMinutes = (typeof SMART_ALARM_WINDOWS)[number];

export type SmartAlarmSelectionInput = {
  /** Target wake time as ISO. */
  targetWakeIso: string;
  windowMinutes: SmartAlarmWindowMinutes;
  /**
   * Optional stage samples inside the window with start ISO and kind.
   * Only used when freshness allows; never invented.
   */
  stageSamples?: Array<{ atIso: string; kind: "awake" | "light" | "deep" | "rem" | "asleep" }>;
  /** Max age of the newest sample relative to now, in minutes. */
  maxSampleAgeMinutes?: number;
  nowIso: string;
};

export type SmartAlarmSelection =
  | { status: "smart"; wakeIso: string; reason: string }
  | { status: "fallback"; wakeIso: string; reason: string };

/**
 * Pick a wake time in [target - window, target].
 * Prefers light/awake samples in the window when fresh; otherwise falls back to target.
 * Does not claim continuous real-time stage detection.
 */
export function selectSmartAlarmWake(input: SmartAlarmSelectionInput): SmartAlarmSelection {
  const targetMs = parseIso(input.targetWakeIso);
  const nowMs = parseIso(input.nowIso);
  if (targetMs == null || nowMs == null) {
    return { status: "fallback", wakeIso: input.targetWakeIso, reason: "Target wake time was not usable; using the configured time." };
  }
  const windowStart = targetMs - input.windowMinutes * 60_000;
  const maxAge = (input.maxSampleAgeMinutes ?? 20) * 60_000;
  const samples = (input.stageSamples ?? [])
    .map((sample) => ({ ...sample, atMs: parseIso(sample.atIso) }))
    .filter((sample): sample is { atIso: string; kind: "awake" | "light" | "deep" | "rem" | "asleep"; atMs: number } => sample.atMs != null)
    .filter((sample) => sample.atMs >= windowStart && sample.atMs <= targetMs)
    .filter((sample) => nowMs - sample.atMs <= maxAge);

  const preferred = samples.filter((sample) => sample.kind === "light" || sample.kind === "awake").sort((a, b) => b.atMs - a.atMs)[0];
  if (preferred) {
    return {
      status: "smart",
      wakeIso: new Date(preferred.atMs).toISOString(),
      reason: `Fresh ${preferred.kind} sample inside the ${input.windowMinutes}-minute window. Not continuous monitoring.`,
    };
  }
  return {
    status: "fallback",
    wakeIso: input.targetWakeIso,
    reason: "No fresh light/awake sample in the window. Falling back to the configured wake time.",
  };
}

export type SleepConsistencyInput = {
  /** Bedtime minute-of-day for recent nights (0–1439). */
  bedtimeMinutes: Array<number | null>;
};

/** Mean absolute deviation from the mean bedtime; null when fewer than 3 nights. */
export function bedtimeConsistencyMinutes(input: SleepConsistencyInput): number | null {
  const values = input.bedtimeMinutes.filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  if (values.length < 3) return null;
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const mad = values.reduce((sum, value) => sum + Math.abs(value - mean), 0) / values.length;
  return Math.round(mad);
}
