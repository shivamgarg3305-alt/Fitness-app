import { useCallback, useEffect, useState } from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";
import {
  SMART_ALARM_WINDOWS,
  SNOOZE_OPTIONS_MINUTES,
  ALARM_SOUNDS,
  defaultSmartAlarmSettings,
  nextSmartAlarmWake,
  validateSmartAlarmSettings,
  type SmartAlarmSettings,
  type Weekday,
} from "@vitacore/domain";
import { AppText, Button, Card, LoadingState, Screen, SegmentedControl, TimeField, Toggle } from "@/components/ui";
import {
  getPermissionState,
  loadSmartAlarmSettings,
  requestPermission,
  saveSmartAlarmSettings,
  scheduleTestAlarm,
  syncSmartAlarm,
  type ReminderPermissionState,
} from "@/notifications/scheduler";
import { useTheme } from "@/design/theme";
import { space } from "@/design/tokens";
import { copy } from "@/i18n/copy";

const WEEKDAY_LABELS: { value: Weekday; label: string }[] = [
  { value: 0, label: "Sun" },
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
];

function minutesToClock(minutes: number): string {
  const hour = Math.floor(minutes / 60) % 24;
  const minute = minutes % 60;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function clockToMinutes(value: string): number | null {
  const match = /^([0-1]?\d|2[0-3]):([0-5]\d)$/.exec(value.trim());
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

export default function SleepAlarmScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const [settings, setSettings] = useState<SmartAlarmSettings | null>(null);
  const [permission, setPermission] = useState<ReminderPermissionState>("unsupported");
  const [status, setStatus] = useState<string | null>(null);
  const [nextLabel, setNextLabel] = useState<string>("—");

  const refreshNext = useCallback((nextSettings: SmartAlarmSettings) => {
    const next = nextSmartAlarmWake(nextSettings, new Date());
    if (next.status === "scheduled") {
      setNextLabel(
        `${next.at.toLocaleString()} · ${next.selection === "smart" ? "smart window" : "target time"}`,
      );
    } else {
      setNextLabel(next.reason);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    Promise.all([loadSmartAlarmSettings(), getPermissionState()]).then(([loaded, perm]) => {
      if (cancelled) return;
      setSettings(loaded);
      setPermission(perm);
      refreshNext(loaded);
    });
    return () => {
      cancelled = true;
    };
  }, [refreshNext]);

  const apply = useCallback(
    async (next: SmartAlarmSettings) => {
      setSettings(next);
      await saveSmartAlarmSettings(next);
      refreshNext(next);
      try {
        await syncSmartAlarm();
        setStatus(null);
      } catch {
        setStatus("Alarm saved locally. Scheduling will retry when you reopen VitaCore.");
      }
    },
    [refreshNext],
  );

  async function toggleEnabled(enabled: boolean) {
    if (!settings) return;
    if (enabled) {
      const granted = await requestPermission();
      setPermission(granted);
      if (granted !== "granted") {
        setStatus("Notification permission is required for the wake alarm.");
        return;
      }
    }
    await apply({ ...settings, enabled });
  }

  if (!settings) return <Screen><LoadingState label="Loading alarm…" /></Screen>;

  const errors = validateSmartAlarmSettings(settings);

  return (
    <Screen>
      <AppText variant="h1">Smart alarm</AppText>
      <AppText variant="small" color={colors.textSecondary}>
        Local notification at your wake time. A smart window only advances the time when a fresh light/awake
        sample is available — periodic health history is not continuous stage detection.
      </AppText>
      <View style={{ height: space.md }} />
      <Card>
        <AppText variant="label">Next wake</AppText>
        <AppText variant="small">{nextLabel}</AppText>
        <AppText variant="caption">{copy.alarmLimit}</AppText>
      </Card>
      {status ? (
        <>
          <View style={{ height: space.sm }} />
          <AppText variant="small" color={colors.textSecondary}>{status}</AppText>
        </>
      ) : null}
      <View style={{ height: space.lg }} />
      <Card>
        <Toggle label="Enable alarm" value={settings.enabled} onChange={(value) => void toggleEnabled(value)} />
        <AppText variant="caption">Permission: {permission}</AppText>
        <View style={{ height: space.md }} />
        <TimeField
          label="Target wake time"
          value={minutesToClock(settings.targetWakeMinutes)}
          onChange={(value) => {
            const minutes = clockToMinutes(value);
            if (minutes != null) void apply({ ...settings, targetWakeMinutes: minutes });
          }}
        />
        <View style={{ height: space.md }} />
        <AppText variant="label">Smart window</AppText>
        <View style={{ height: space.sm }} />
        <SegmentedControl
          options={SMART_ALARM_WINDOWS.map((minutes) => ({ value: String(minutes), label: `${minutes}m` }))}
          value={String(settings.windowMinutes)}
          onChange={(value) =>
            void apply({ ...settings, windowMinutes: Number(value) as SmartAlarmSettings["windowMinutes"] })
          }
        />
        <View style={{ height: space.md }} />
        <AppText variant="label">Repeat days</AppText>
        <View style={{ height: space.sm }} />
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
          {WEEKDAY_LABELS.map((day) => {
            const selected = settings.days.includes(day.value);
            return (
              <Button
                key={day.value}
                label={day.label}
                tone={selected ? "primary" : "secondary"}
                onPress={() => {
                  const days = selected
                    ? settings.days.filter((item) => item !== day.value)
                    : [...settings.days, day.value];
                  void apply({ ...settings, days });
                }}
              />
            );
          })}
        </View>
        {errors.find((error) => error.field === "days") ? (
          <AppText variant="caption" color={colors.accent}>{errors.find((error) => error.field === "days")?.message}</AppText>
        ) : null}
        <View style={{ height: space.md }} />
        <AppText variant="label">Sound</AppText>
        <View style={{ height: space.sm }} />
        <SegmentedControl
          options={ALARM_SOUNDS.map((sound) => ({ value: sound, label: sound.replace("_", " ") }))}
          value={settings.sound}
          onChange={(value) => void apply({ ...settings, sound: value as SmartAlarmSettings["sound"] })}
        />
        <View style={{ height: space.md }} />
        <Toggle
          label="Vibration (where supported)"
          value={settings.vibration}
          onChange={(value) => void apply({ ...settings, vibration: value })}
        />
        <View style={{ height: space.md }} />
        <AppText variant="label">Snooze</AppText>
        <View style={{ height: space.sm }} />
        <SegmentedControl
          options={SNOOZE_OPTIONS_MINUTES.map((minutes) => ({ value: String(minutes), label: `${minutes}m` }))}
          value={String(settings.snoozeMinutes)}
          onChange={(value) =>
            void apply({ ...settings, snoozeMinutes: Number(value) as SmartAlarmSettings["snoozeMinutes"] })
          }
        />
        <View style={{ height: space.md }} />
        <TimeField
          label="Usual bedtime"
          value={minutesToClock(settings.usualBedtimeMinutes)}
          onChange={(value) => {
            const minutes = clockToMinutes(value);
            if (minutes != null) void apply({ ...settings, usualBedtimeMinutes: minutes });
          }}
        />
        <View style={{ height: space.sm }} />
        <Toggle
          label="Bedtime reminder (30 min before usual bedtime)"
          value={settings.bedtimeReminderOffsetMinutes != null}
          onChange={(value) =>
            void apply({ ...settings, bedtimeReminderOffsetMinutes: value ? 30 : null })
          }
        />
        <Toggle
          label="Wind-down reminder"
          value={settings.windDownOffsetMinutes != null}
          onChange={(value) => void apply({ ...settings, windDownOffsetMinutes: value ? 60 : null })}
        />
        <Toggle
          label="Bedtime/wind-down respect quiet hours"
          value={settings.remindersRespectQuietHours}
          onChange={(value) => void apply({ ...settings, remindersRespectQuietHours: value })}
        />
        <AppText variant="caption">
          The wake alarm itself never uses quiet hours. OS battery optimization and force-quit can still silence it.
        </AppText>
      </Card>
      <View style={{ height: space.lg }} />
      <Button
        label="Test alarm (5s)"
        tone="secondary"
        onPress={() => {
          void (async () => {
            const granted = await requestPermission();
            setPermission(granted);
            if (granted !== "granted") {
              setStatus("Allow notifications to test the alarm.");
              return;
            }
            try {
              await scheduleTestAlarm();
              setStatus("Test alarm scheduled in about 5 seconds.");
            } catch {
              setStatus("Could not schedule the test alarm.");
            }
          })();
        }}
      />
      <View style={{ height: space.sm }} />
      <Button label="Reset defaults" tone="ghost" onPress={() => void apply(defaultSmartAlarmSettings())} />
      <View style={{ height: space.sm }} />
      <Button label="Back" tone="ghost" onPress={() => router.back()} />
    </Screen>
  );
}
