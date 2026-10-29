/**
 * Local reminder + smart-alarm scheduling.
 *
 * Scheduling decisions live in @vitacore/domain (reminders.ts, smartAlarm.ts).
 * This file only turns plans into OS calls and preference I/O.
 */
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import {
  ALARM_ID_PREFIX,
  defaultReminderSettings,
  defaultSmartAlarmSettings,
  desiredSchedule,
  diffSchedule,
  isAllowedNotificationRoute,
  isQuietMinute,
  NOTIFICATION_ID_PREFIX,
  parseReminderSettings,
  parseSmartAlarmSettings,
  planSmartAlarmNotifications,
  planTestAlarm,
  serializeReminderSettings,
  serializeSmartAlarmSettings,
  reminderPermissionState,
  shouldRequestPermission,
  type GoalProgress,
  type NotificationPermission,
  type PlannedAlarmNotification,
  type PlannedNotification,
  type ReminderPermissionState,
  type ReminderSettings,
  type SleepReminderContext,
  type SmartAlarmSettings,
} from "@vitacore/domain";
import { readPreference, writePreference } from "@/data/db";
import { getActiveSleepSession } from "@/data/sleep-session";
import { latestManualSleep } from "@/data/logs";

const SETTINGS_KEY = "reminder_settings";
const SIGNATURES_KEY = "reminder_notification_signatures";
const ALARM_SETTINGS_KEY = "smart_alarm_settings";
const ALARM_SIGNATURES_KEY = "smart_alarm_notification_signatures";

const supported = Platform.OS === "ios" || Platform.OS === "android";

export const WORKOUT_CHANNEL_ID = "vitacore-workout";
export const HYDRATION_CHANNEL_ID = "vitacore-hydration";
export const GOAL_CHANNEL_ID = "vitacore-goals";
export const SLEEP_CHANNEL_ID = "vitacore-sleep";
export const ALARM_CHANNEL_ID = "vitacore-alarm";

let handlerSet = false;

export async function configureNotifications(): Promise<void> {
  if (!supported) return;
  if (!handlerSet) {
    handlerSet = true;
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
  }
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync(WORKOUT_CHANNEL_ID, {
      name: "Workout reminders",
      importance: Notifications.AndroidImportance.DEFAULT,
    });
    await Notifications.setNotificationChannelAsync(HYDRATION_CHANNEL_ID, {
      name: "Hydration reminders",
      importance: Notifications.AndroidImportance.DEFAULT,
    });
    await Notifications.setNotificationChannelAsync(GOAL_CHANNEL_ID, {
      name: "Daily goal reminders",
      importance: Notifications.AndroidImportance.DEFAULT,
    });
    await Notifications.setNotificationChannelAsync(SLEEP_CHANNEL_ID, {
      name: "Sleep reminders",
      importance: Notifications.AndroidImportance.DEFAULT,
    });
    await Notifications.setNotificationChannelAsync(ALARM_CHANNEL_ID, {
      name: "Wake alarms",
      importance: Notifications.AndroidImportance.HIGH,
      bypassDnd: false,
    });
  }
}

function channelFor(kind: PlannedNotification["kind"]): string {
  if (kind === "workout") return WORKOUT_CHANNEL_ID;
  if (kind === "hydration") return HYDRATION_CHANNEL_ID;
  if (kind === "goal") return GOAL_CHANNEL_ID;
  return SLEEP_CHANNEL_ID;
}

export async function loadReminderSettings(): Promise<ReminderSettings> {
  const raw = await readPreference(SETTINGS_KEY);
  return parseReminderSettings(raw);
}

export async function saveReminderSettings(settings: ReminderSettings): Promise<void> {
  await writePreference(SETTINGS_KEY, serializeReminderSettings(settings));
}

export async function loadSmartAlarmSettings(): Promise<SmartAlarmSettings> {
  const raw = await readPreference(ALARM_SETTINGS_KEY);
  return parseSmartAlarmSettings(raw);
}

export async function saveSmartAlarmSettings(settings: SmartAlarmSettings): Promise<void> {
  await writePreference(ALARM_SETTINGS_KEY, serializeSmartAlarmSettings(settings));
}

async function loadSignatures(key: string): Promise<Record<string, string>> {
  const raw = await readPreference(key);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return typeof parsed === "object" && parsed !== null ? (parsed as Record<string, string>) : {};
  } catch {
    return {};
  }
}

async function saveSignatures(key: string, signatures: Record<string, string>): Promise<void> {
  await writePreference(key, JSON.stringify(signatures));
}

export async function getPermissionState(): Promise<ReminderPermissionState> {
  if (!supported) return reminderPermissionState(null, false);
  const result = await Notifications.getPermissionsAsync();
  const permission: NotificationPermission = {
    status: result.granted
      ? "granted"
      : result.canAskAgain === false
        ? "denied"
        : result.status === "undetermined"
          ? "undetermined"
          : "denied",
    canAskAgain: result.canAskAgain !== false,
  };
  return reminderPermissionState(permission, true);
}

export async function requestPermission(): Promise<ReminderPermissionState> {
  if (!supported) return "unsupported";
  const current = await getPermissionState();
  if (!shouldRequestPermission(current)) return current;
  const result = await Notifications.requestPermissionsAsync();
  const permission: NotificationPermission = {
    status: result.granted
      ? "granted"
      : result.status === "undetermined" && result.canAskAgain !== false
        ? "undetermined"
        : "denied",
    canAskAgain: result.canAskAgain !== false,
  };
  return reminderPermissionState(permission, true);
}

function toTrigger(planned: PlannedNotification): Notifications.NotificationTriggerInput {
  if (planned.trigger.type === "weekly") {
    return {
      type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
      weekday: planned.trigger.weekday + 1,
      hour: planned.trigger.hour,
      minute: planned.trigger.minute,
    };
  }
  return { type: Notifications.SchedulableTriggerInputTypes.DATE, date: planned.trigger.at };
}

async function buildSleepContext(sleepTargetMinutes: number | null): Promise<SleepReminderContext> {
  const active = await getActiveSleepSession();
  const latest = await latestManualSleep();
  let lastNightAsleepMinutes: number | null = null;
  if (latest?.asleep_confirmed === 1) {
    lastNightAsleepMinutes = Math.max(
      0,
      Math.round((Date.parse(latest.asleep_end) - Date.parse(latest.asleep_start)) / 60_000),
    );
  }
  return {
    hasActiveManualSession: Boolean(active),
    lastNightAsleepMinutes,
    sleepTargetMinutes,
  };
}

export async function syncReminders(
  goals: GoalProgress,
  now: Date = new Date(),
  sleepTargetMinutes: number | null = null,
): Promise<{ scheduled: number; cancelled: number }> {
  if (!supported) return { scheduled: 0, cancelled: 0 };
  const settings = await loadReminderSettings();
  const permission = await getPermissionState();
  const sleep = await buildSleepContext(sleepTargetMinutes);
  const plan = desiredSchedule(settings, { now, goals, sleep }, permission);

  const existing = await Notifications.getAllScheduledNotificationsAsync();
  const existingIds = existing
    .map((item) => item.identifier)
    .filter((id) => id.startsWith(NOTIFICATION_ID_PREFIX) && !id.startsWith(ALARM_ID_PREFIX));
  const storedSignatures = await loadSignatures(SIGNATURES_KEY);
  const diff = diffSchedule(plan.notifications, existingIds, storedSignatures);

  for (const id of diff.cancel) {
    await Notifications.cancelScheduledNotificationAsync(id);
  }
  const plannedById = new Map(plan.notifications.map((item) => [item.id, item]));
  for (const item of diff.schedule) {
    const planned = plannedById.get(item.id);
    if (!planned) continue;
    await Notifications.scheduleNotificationAsync({
      identifier: planned.id,
      content: {
        title: planned.title,
        body: planned.body,
        data: { route: planned.route },
        ...(Platform.OS === "android" ? { channelId: channelFor(planned.kind) } : null),
      },
      trigger: toTrigger(planned),
    });
  }
  await saveSignatures(SIGNATURES_KEY, diff.signatures);
  return { scheduled: diff.schedule.length, cancelled: diff.cancel.length };
}

function alarmSignature(planned: PlannedAlarmNotification): string {
  return [planned.kind, planned.title, planned.body, planned.at.getTime(), planned.sound, planned.vibration].join("|");
}

export async function syncSmartAlarm(now: Date = new Date()): Promise<{ scheduled: number; cancelled: number }> {
  if (!supported) return { scheduled: 0, cancelled: 0 };
  const settings = await loadSmartAlarmSettings();
  const permission = await getPermissionState();
  const reminderSettings = await loadReminderSettings();
  const planned =
    permission === "granted"
      ? planSmartAlarmNotifications(settings, now, {
          isQuietMinute: (minute) => isQuietMinute(minute, reminderSettings.quietHours),
        })
      : [];

  const existing = await Notifications.getAllScheduledNotificationsAsync();
  const existingIds = existing.map((item) => item.identifier).filter((id) => id.startsWith(ALARM_ID_PREFIX));
  const storedSignatures = await loadSignatures(ALARM_SIGNATURES_KEY);
  const signatures: Record<string, string> = {};
  const plannedById = new Map<string, PlannedAlarmNotification>();
  for (const item of planned) {
    plannedById.set(item.id, item);
    signatures[item.id] = alarmSignature(item);
  }
  const cancel: string[] = [];
  for (const id of existingIds) {
    if (!plannedById.has(id) || storedSignatures[id] !== signatures[id]) cancel.push(id);
  }
  const schedule = planned.filter(
    (item) => !existingIds.includes(item.id) || storedSignatures[item.id] !== signatures[item.id],
  );

  for (const id of cancel) {
    await Notifications.cancelScheduledNotificationAsync(id);
  }
  for (const item of schedule) {
    await Notifications.scheduleNotificationAsync({
      identifier: item.id,
      content: {
        title: item.title,
        body: item.body,
        data: { route: "/sleep" },
        sound: item.sound === "default" ? true : item.sound,
        ...(Platform.OS === "android" ? { channelId: ALARM_CHANNEL_ID, vibrate: item.vibration ? [0, 250, 250, 250] : undefined } : null),
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: item.at },
    });
  }
  await saveSignatures(ALARM_SIGNATURES_KEY, signatures);
  return { scheduled: schedule.length, cancelled: cancel.length };
}

export async function scheduleTestAlarm(now: Date = new Date()): Promise<void> {
  if (!supported) return;
  const settings = await loadSmartAlarmSettings();
  const planned = planTestAlarm(now, settings, 5);
  await Notifications.scheduleNotificationAsync({
    identifier: planned.id,
    content: {
      title: planned.title,
      body: planned.body,
      data: { route: "/sleep" },
      sound: true,
      ...(Platform.OS === "android" ? { channelId: ALARM_CHANNEL_ID } : null),
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: planned.at },
  });
}

export async function cancelAllReminders(): Promise<void> {
  if (!supported) return;
  const existing = await Notifications.getAllScheduledNotificationsAsync();
  for (const item of existing) {
    if (item.identifier.startsWith(NOTIFICATION_ID_PREFIX) || item.identifier.startsWith(ALARM_ID_PREFIX)) {
      await Notifications.cancelScheduledNotificationAsync(item.identifier);
    }
  }
  await saveSignatures(SIGNATURES_KEY, {});
  await saveSignatures(ALARM_SIGNATURES_KEY, {});
}

export function routeForNotificationResponse(response: Notifications.NotificationResponse): string | null {
  const route = response.notification.request.content.data?.route;
  return isAllowedNotificationRoute(route) ? route : null;
}

export { defaultReminderSettings, defaultSmartAlarmSettings };
export type { GoalProgress, ReminderPermissionState, ReminderSettings, SmartAlarmSettings };
