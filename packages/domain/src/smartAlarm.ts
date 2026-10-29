/**
 * Smart-alarm configuration and next-wake planning.
 * Uses selectSmartAlarmWake for window selection when fresh stage samples exist.
 * Delivery is still a local notification — OS background limits apply.
 */

import {
  SMART_ALARM_WINDOWS,
  selectSmartAlarmWake,
  type SmartAlarmWindowMinutes,
} from "./sleepSession";
import type { Weekday } from "./reminders";

export const SMART_ALARM_SETTINGS_VERSION = 1;

export const SNOOZE_OPTIONS_MINUTES = [5, 10, 15] as const;
export type SnoozeMinutes = (typeof SNOOZE_OPTIONS_MINUTES)[number];

export const ALARM_SOUNDS = ["default", "chime", "soft_bell"] as const;
export type AlarmSoundId = (typeof ALARM_SOUNDS)[number];

export type SmartAlarmSettings = {
  version: typeof SMART_ALARM_SETTINGS_VERSION;
  enabled: boolean;
  /** Target wake minute-of-day (0–1439). */
  targetWakeMinutes: number;
  windowMinutes: SmartAlarmWindowMinutes;
  sound: AlarmSoundId;
  vibration: boolean;
  days: Weekday[];
  snoozeMinutes: SnoozeMinutes;
  /** Optional bedtime reminder: minutes before target bedtime (null = off). */
  bedtimeReminderOffsetMinutes: number | null;
  /** Optional wind-down reminder: minutes before bedtime reminder (null = off). */
  windDownOffsetMinutes: number | null;
  /** Usual bedtime minute-of-day used for bedtime/wind-down reminders. */
  usualBedtimeMinutes: number;
  /**
   * When true, bedtime/wind-down reminders respect quiet hours.
   * The wake alarm itself never uses quiet hours (explicitly configured).
   */
  remindersRespectQuietHours: boolean;
};

export function defaultSmartAlarmSettings(): SmartAlarmSettings {
  return {
    version: SMART_ALARM_SETTINGS_VERSION,
    enabled: false,
    targetWakeMinutes: 7 * 60,
    windowMinutes: 30,
    sound: "default",
    vibration: true,
    days: [0, 1, 2, 3, 4, 5, 6],
    snoozeMinutes: 10,
    bedtimeReminderOffsetMinutes: 30,
    windDownOffsetMinutes: 60,
    usualBedtimeMinutes: 22 * 60 + 30,
    remindersRespectQuietHours: true,
  };
}

const MINUTES_PER_DAY = 1440;

function readBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function readMinutes(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value < MINUTES_PER_DAY
    ? value
    : fallback;
}

function readWeekdays(value: unknown, fallback: Weekday[]): Weekday[] {
  if (!Array.isArray(value)) return fallback;
  const days = new Set<Weekday>();
  for (const item of value) {
    if (typeof item === "number" && Number.isInteger(item) && item >= 0 && item <= 6) days.add(item as Weekday);
  }
  return Array.from(days).sort((a, b) => a - b);
}

function readWindow(value: unknown, fallback: SmartAlarmWindowMinutes): SmartAlarmWindowMinutes {
  return (SMART_ALARM_WINDOWS as readonly number[]).includes(value as number)
    ? (value as SmartAlarmWindowMinutes)
    : fallback;
}

function readSnooze(value: unknown, fallback: SnoozeMinutes): SnoozeMinutes {
  return (SNOOZE_OPTIONS_MINUTES as readonly number[]).includes(value as number)
    ? (value as SnoozeMinutes)
    : fallback;
}

function readSound(value: unknown, fallback: AlarmSoundId): AlarmSoundId {
  return (ALARM_SOUNDS as readonly string[]).includes(value as string) ? (value as AlarmSoundId) : fallback;
}

function readNullableOffset(value: unknown, fallback: number | null): number | null {
  if (value === null) return null;
  if (typeof value === "number" && Number.isInteger(value) && value > 0 && value <= 180) return value;
  return fallback;
}

export function parseSmartAlarmSettings(raw: string | null | undefined): SmartAlarmSettings {
  const defaults = defaultSmartAlarmSettings();
  if (!raw) return defaults;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return defaults;
  }
  if (typeof parsed !== "object" || parsed === null) return defaults;
  const source = parsed as Record<string, unknown>;
  if (source.version !== SMART_ALARM_SETTINGS_VERSION) return defaults;
  return {
    version: SMART_ALARM_SETTINGS_VERSION,
    enabled: readBoolean(source.enabled, defaults.enabled),
    targetWakeMinutes: readMinutes(source.targetWakeMinutes, defaults.targetWakeMinutes),
    windowMinutes: readWindow(source.windowMinutes, defaults.windowMinutes),
    sound: readSound(source.sound, defaults.sound),
    vibration: readBoolean(source.vibration, defaults.vibration),
    days: readWeekdays(source.days, defaults.days),
    snoozeMinutes: readSnooze(source.snoozeMinutes, defaults.snoozeMinutes),
    bedtimeReminderOffsetMinutes: readNullableOffset(
      source.bedtimeReminderOffsetMinutes,
      defaults.bedtimeReminderOffsetMinutes,
    ),
    windDownOffsetMinutes: readNullableOffset(source.windDownOffsetMinutes, defaults.windDownOffsetMinutes),
    usualBedtimeMinutes: readMinutes(source.usualBedtimeMinutes, defaults.usualBedtimeMinutes),
    remindersRespectQuietHours: readBoolean(source.remindersRespectQuietHours, defaults.remindersRespectQuietHours),
  };
}

export function serializeSmartAlarmSettings(settings: SmartAlarmSettings): string {
  return JSON.stringify(settings);
}

export type SmartAlarmValidationError = { field: string; message: string };

export function validateSmartAlarmSettings(settings: SmartAlarmSettings): SmartAlarmValidationError[] {
  const errors: SmartAlarmValidationError[] = [];
  if (settings.enabled && settings.days.length === 0) {
    errors.push({ field: "days", message: "Pick at least one day for the alarm." });
  }
  if (!(SMART_ALARM_WINDOWS as readonly number[]).includes(settings.windowMinutes)) {
    errors.push({ field: "windowMinutes", message: "Smart window must be 15, 30, or 45 minutes." });
  }
  return errors;
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function atLocal(now: Date, dayOffset: number, minutes: number): Date {
  return new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + dayOffset,
    Math.floor(minutes / 60),
    minutes % 60,
    0,
    0,
  );
}

function wrapMinutes(minutes: number): number {
  return ((minutes % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
}

export type NextWakeResult =
  | {
      status: "scheduled";
      at: Date;
      selection: "smart" | "fallback";
      reason: string;
    }
  | { status: "disabled"; reason: string }
  | { status: "invalid"; reason: string };

/**
 * Next enabled wake occurrence from `now`.
 * Stage samples only influence the wake instant when they are fresh and inside the window;
 * otherwise the configured target is used.
 */
export function nextSmartAlarmWake(
  settings: SmartAlarmSettings,
  now: Date,
  stageSamples?: Array<{ atIso: string; kind: "awake" | "light" | "deep" | "rem" | "asleep" }>,
): NextWakeResult {
  if (!settings.enabled) return { status: "disabled", reason: "Alarm is off." };
  const errors = validateSmartAlarmSettings(settings);
  if (errors.length > 0) return { status: "invalid", reason: errors[0]!.message };

  const earliest = now.getTime() + 30_000;
  for (let offset = 0; offset < 8; offset += 1) {
    const candidate = atLocal(now, offset, settings.targetWakeMinutes);
    if (candidate.getTime() < earliest) continue;
    if (!settings.days.includes(candidate.getDay() as Weekday)) continue;

    const selection = selectSmartAlarmWake({
      targetWakeIso: candidate.toISOString(),
      windowMinutes: settings.windowMinutes,
      stageSamples,
      nowIso: now.toISOString(),
      maxSampleAgeMinutes: 20,
    });
    const wakeAt = new Date(selection.wakeIso);
    // Only apply a smart earlier wake when we are already inside/near the window for today.
    const useSmart =
      selection.status === "smart" &&
      wakeAt.getTime() >= earliest &&
      wakeAt.getTime() <= candidate.getTime() &&
      candidate.getTime() - now.getTime() <= settings.windowMinutes * 60_000 + 60_000;

    return {
      status: "scheduled",
      at: useSmart ? wakeAt : candidate,
      selection: useSmart ? "smart" : "fallback",
      reason: useSmart ? selection.reason : "Using the configured target wake time.",
    };
  }
  return { status: "invalid", reason: "No matching day in the next week." };
}

export type PlannedAlarmNotification = {
  id: string;
  kind: "wake_alarm" | "bedtime_reminder" | "wind_down_reminder" | "test_alarm";
  title: string;
  body: string;
  at: Date;
  sound: AlarmSoundId;
  vibration: boolean;
};

export const ALARM_ID_PREFIX = "vitacore.alarm.";

/**
 * Builds wake + optional bedtime/wind-down notifications for the next few days.
 * Quiet hours never suppress the wake alarm. Bedtime/wind-down may be skipped when
 * remindersRespectQuietHours is true and the caller reports the minute is quiet.
 */
export function planSmartAlarmNotifications(
  settings: SmartAlarmSettings,
  now: Date,
  options?: {
    isQuietMinute?: (minute: number) => boolean;
    stageSamples?: Array<{ atIso: string; kind: "awake" | "light" | "deep" | "rem" | "asleep" }>;
    horizonDays?: number;
  },
): PlannedAlarmNotification[] {
  if (!settings.enabled) return [];
  if (validateSmartAlarmSettings(settings).length > 0) return [];

  const horizon = options?.horizonDays ?? 3;
  const earliest = now.getTime() + 60_000;
  const out: PlannedAlarmNotification[] = [];
  const next = nextSmartAlarmWake(settings, now, options?.stageSamples);
  if (next.status === "scheduled" && next.at.getTime() >= earliest) {
    out.push({
      id: `${ALARM_ID_PREFIX}wake.${next.at.getFullYear()}${pad(next.at.getMonth() + 1)}${pad(next.at.getDate())}`,
      kind: "wake_alarm",
      title: "Wake up",
      body:
        next.selection === "smart"
          ? "Smart window found a fresher light/awake sample. Delivery still depends on the OS."
          : "Configured wake time. This is a local notification, not a guaranteed hardware alarm.",
      at: next.at,
      sound: settings.sound,
      vibration: settings.vibration,
    });
  }

  for (let offset = 0; offset < horizon; offset += 1) {
    const wakeDay = atLocal(now, offset, settings.targetWakeMinutes);
    if (!settings.days.includes(wakeDay.getDay() as Weekday)) continue;

    if (settings.bedtimeReminderOffsetMinutes != null) {
      // Minutes before usual bedtime on the calendar evening preceding the wake day.
      const bedtimeAt = atLocal(now, offset - 1, wrapMinutes(settings.usualBedtimeMinutes));
      const reminderAt = new Date(bedtimeAt.getTime() - settings.bedtimeReminderOffsetMinutes * 60_000);
      if (reminderAt.getTime() >= earliest) {
        const minute = reminderAt.getHours() * 60 + reminderAt.getMinutes();
        const quiet =
          settings.remindersRespectQuietHours && options?.isQuietMinute ? options.isQuietMinute(minute) : false;
        if (!quiet) {
          out.push({
            id: `${ALARM_ID_PREFIX}bedtime.${reminderAt.getFullYear()}${pad(reminderAt.getMonth() + 1)}${pad(reminderAt.getDate())}${pad(reminderAt.getHours())}${pad(reminderAt.getMinutes())}`,
            kind: "bedtime_reminder",
            title: "Bedtime soon",
            body: "Wind down when you are ready. This is a reminder, not a sleep measurement.",
            at: reminderAt,
            sound: settings.sound,
            vibration: false,
          });
        }
      }
    }

    if (settings.windDownOffsetMinutes != null && settings.bedtimeReminderOffsetMinutes != null) {
      const bedtimeAt = atLocal(now, offset - 1, wrapMinutes(settings.usualBedtimeMinutes));
      const windAt = new Date(
        bedtimeAt.getTime() -
          (settings.bedtimeReminderOffsetMinutes + settings.windDownOffsetMinutes) * 60_000,
      );
      if (windAt.getTime() >= earliest) {
        const minute = windAt.getHours() * 60 + windAt.getMinutes();
        const quiet =
          settings.remindersRespectQuietHours && options?.isQuietMinute ? options.isQuietMinute(minute) : false;
        if (!quiet) {
          out.push({
            id: `${ALARM_ID_PREFIX}wind.${windAt.getFullYear()}${pad(windAt.getMonth() + 1)}${pad(windAt.getDate())}${pad(windAt.getHours())}${pad(windAt.getMinutes())}`,
            kind: "wind_down_reminder",
            title: "Wind-down time",
            body: "A quieter hour helps sleep consistency. Optional — you can silence this in settings.",
            at: windAt,
            sound: "soft_bell",
            vibration: false,
          });
        }
      }
    }
  }

  // Stable unique ids; drop duplicates if horizon overlaps.
  const seen = new Set<string>();
  return out.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

export function planTestAlarm(now: Date, settings: SmartAlarmSettings, delaySeconds = 5): PlannedAlarmNotification {
  return {
    id: `${ALARM_ID_PREFIX}test`,
    kind: "test_alarm",
    title: "Test alarm",
    body: "This confirms notification permission and sound routing. It is not a smart wake.",
    at: new Date(now.getTime() + delaySeconds * 1000),
    sound: settings.sound,
    vibration: settings.vibration,
  };
}
