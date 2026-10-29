import { useCallback, useEffect, useState } from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";
import {
  HYDRATION_INTERVALS,
  defaultReminderSettings,
  validateReminderSettings,
  type HydrationInterval,
  type ReminderSettings,
  type Weekday,
} from "@vitacore/domain";
import { ProfileHeader } from "@/components/profile-header";
import { AppText, Button, Card, ErrorState, LoadingState, Screen, SegmentedControl, TimeField, Toggle } from "@/components/ui";
import { useAppState } from "@/data/app-state";
import { currentGoalProgress } from "@/notifications/goals";
import {
  getPermissionState,
  loadReminderSettings,
  requestPermission,
  saveReminderSettings,
  syncReminders,
  type ReminderPermissionState,
} from "@/notifications/scheduler";
import { openAppSettings } from "@/platform/system-settings";
import { useTheme } from "@/design/theme";
import { space } from "@/design/tokens";

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

/** Returns null for anything that is not a real HH:MM time, so a bad edit is refused rather than silently miscomputed. */
function clockToMinutes(value: string): number | null {
  const match = /^([0-1]?\d|2[0-3]):([0-5]\d)$/.exec(value.trim());
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

const PERMISSION_COPY: Record<ReminderPermissionState, string> = {
  unsupported: "Reminders are not available in this preview.",
  granted: "Notifications are allowed.",
  not_asked: "VitaCore will ask for notification permission when you turn on your first reminder.",
  denied_can_retry: "Notifications are off. Turning on a reminder will ask again.",
  blocked: "Notifications are turned off for VitaCore in system settings. Reminders will stay silent until you turn them back on there.",
};

type SleepSection = "bedtime" | "windDown" | "sleepGoal" | "morningSummary" | "incompleteSession" | "sleepConsistency";

function SleepCategoryCard({
  title,
  section,
  help,
  settings,
  onToggle,
  onApply,
  secondaryColor,
}: {
  title: string;
  section: SleepSection;
  help: string;
  settings: ReminderSettings;
  onToggle: (section: SleepSection, enabled: boolean) => void;
  onApply: (next: ReminderSettings) => void;
  secondaryColor: string;
}) {
  const category = settings[section];
  return (
    <Card>
      <Toggle label={title} value={category.enabled} onChange={(value) => onToggle(section, value)} />
      {category.enabled ? (
        <>
          <View style={{ height: space.md }} />
          <TimeField
            label="Time"
            value={minutesToClock(category.timeMinutes)}
            onChange={(value) => {
              const minutes = clockToMinutes(value);
              if (minutes != null) onApply({ ...settings, [section]: { ...category, timeMinutes: minutes } });
            }}
          />
          <View style={{ height: space.sm }} />
          <AppText variant="label">Days</AppText>
          <View style={{ height: space.sm }} />
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
            {WEEKDAY_LABELS.map((day) => {
              const selected = category.days.includes(day.value);
              return (
                <Button
                  key={day.value}
                  label={day.label}
                  tone={selected ? "primary" : "secondary"}
                  onPress={() => {
                    const days = selected
                      ? category.days.filter((item) => item !== day.value)
                      : [...category.days, day.value];
                    onApply({ ...settings, [section]: { ...category, days } });
                  }}
                />
              );
            })}
          </View>
          <AppText variant="caption" color={secondaryColor}>{help}</AppText>
        </>
      ) : null}
    </Card>
  );
}

export default function RemindersScreen() {
  const router = useRouter();
  const { profile } = useAppState();
  const { colors } = useTheme();
  const [settings, setSettings] = useState<ReminderSettings | null>(null);
  const [permission, setPermission] = useState<ReminderPermissionState>("unsupported");
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([loadReminderSettings(), getPermissionState()]).then(([loaded, perm]) => {
      if (cancelled) return;
      setSettings(loaded);
      setPermission(perm);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const apply = useCallback(
    async (next: ReminderSettings) => {
      setSettings(next);
      await saveReminderSettings(next);
      try {
        const goals = await currentGoalProgress(profile);
        await syncReminders(goals, new Date(), profile?.sleepTargetMinutes ?? null);
      } catch {
        setStatus("Reminders were saved, but could not be scheduled just now. They will sync again the next time you open VitaCore.");
      }
    },
    [profile],
  );

  async function toggleSection(
    section: "workout" | "hydration" | "goals" | SleepSection,
    enabled: boolean,
  ) {
    if (!settings) return;
    if (enabled) {
      const granted = await requestPermission();
      setPermission(granted);
      if (granted !== "granted") {
        setStatus(PERMISSION_COPY[granted]);
        return;
      }
    }
    await apply({ ...settings, [section]: { ...settings[section], enabled } });
  }

  if (!settings) return <Screen><LoadingState label="Loading reminders…" /></Screen>;

  const errors = validateReminderSettings(settings);
  const errorFor = (field: string) => errors.find((error) => error.field === field)?.message ?? null;

  return (
    <Screen>
      <ProfileHeader title="Reminders" />
      <View style={{ height: space.sm }} />
      <AppText variant="small" color={colors.textSecondary}>
        Reminders are scheduled on this device only. Nothing is sent anywhere to remind you.
      </AppText>
      <View style={{ height: space.md }} />
      <Card>
        <AppText variant="small" color={permission === "granted" ? colors.textSecondary : colors.accent}>
          {PERMISSION_COPY[permission]}
        </AppText>
        {permission === "blocked" ? (
          <>
            <View style={{ height: space.sm }} />
            <Button label="Open notification settings" tone="secondary" onPress={() => void openAppSettings()} />
          </>
        ) : null}
      </Card>
      {permission === "blocked" ? (
        <>
          <View style={{ height: space.md }} />
          <ErrorState
            title="Notifications are blocked"
            body="VitaCore cannot schedule reminders until notifications are allowed in system settings."
            action={{ label: "Open system settings", onPress: () => void openAppSettings() }}
          />
        </>
      ) : null}
      {status ? (
        <>
          <View style={{ height: space.sm }} />
          <AppText variant="small" color={colors.textSecondary}>{status}</AppText>
        </>
      ) : null}

      <View style={{ height: space.lg }} />
      <Card>
        <Toggle label="Workout reminders" value={settings.workout.enabled} onChange={(value) => void toggleSection("workout", value)} />
        {settings.workout.enabled ? (
          <>
            <View style={{ height: space.md }} />
            <AppText variant="label">Days</AppText>
            <View style={{ height: space.sm }} />
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
              {WEEKDAY_LABELS.map((day) => {
                const selected = settings.workout.days.includes(day.value);
                return (
                  <Button
                    key={day.value}
                    label={day.label}
                    tone={selected ? "primary" : "secondary"}
                    onPress={() => {
                      const days = selected ? settings.workout.days.filter((d) => d !== day.value) : [...settings.workout.days, day.value];
                      void apply({ ...settings, workout: { ...settings.workout, days } });
                    }}
                  />
                );
              })}
            </View>
            {errorFor("workout.days") ? (
              <AppText variant="caption" color={colors.accent}>{errorFor("workout.days")}</AppText>
            ) : null}
            <View style={{ height: space.md }} />
            <TimeField
              label="Time"
              value={minutesToClock(settings.workout.timeMinutes)}
              onChange={(value) => {
                const minutes = clockToMinutes(value);
                if (minutes != null) void apply({ ...settings, workout: { ...settings.workout, timeMinutes: minutes } });
              }}
            />
          </>
        ) : null}
      </Card>

      <View style={{ height: space.lg }} />
      <Card>
        <Toggle label="Hydration reminders" value={settings.hydration.enabled} onChange={(value) => void toggleSection("hydration", value)} />
        {settings.hydration.enabled ? (
          <>
            <View style={{ height: space.md }} />
            <AppText variant="label">Every</AppText>
            <View style={{ height: space.sm }} />
            <SegmentedControl
              options={HYDRATION_INTERVALS.map((minutes) => ({ value: String(minutes), label: minutes < 120 ? `${minutes}m` : `${minutes / 60}h` }))}
              value={String(settings.hydration.intervalMinutes)}
              onChange={(value) => void apply({ ...settings, hydration: { ...settings.hydration, intervalMinutes: Number(value) as HydrationInterval } })}
            />
            <View style={{ height: space.sm }} />
            <AppText variant="caption" color={colors.textSecondary}>
              Sent between 7:00 AM and 10:00 PM by default, or during the hours below quiet hours allows. Stops for the day once your water goal is reached.
            </AppText>
          </>
        ) : null}
      </Card>

      <View style={{ height: space.lg }} />
      <Card>
        <Toggle label="Daily goal reminders" value={settings.goals.enabled} onChange={(value) => void toggleSection("goals", value)} />
        {settings.goals.enabled ? (
          <>
            <View style={{ height: space.md }} />
            <TimeField
              label="Time"
              value={minutesToClock(settings.goals.timeMinutes)}
              onChange={(value) => {
                const minutes = clockToMinutes(value);
                if (minutes != null) void apply({ ...settings, goals: { ...settings.goals, timeMinutes: minutes } });
              }}
            />
            <AppText variant="caption" color={colors.textSecondary}>
              Only sent when a goal you have set (steps or water) is not yet met that day.
            </AppText>
          </>
        ) : null}
      </Card>

      <View style={{ height: space.lg }} />
      <Card>
        <Toggle
          label="Quiet hours"
          value={settings.quietHours.enabled}
          onChange={(value) => void apply({ ...settings, quietHours: { ...settings.quietHours, enabled: value } })}
        />
        {settings.quietHours.enabled ? (
          <>
            <View style={{ height: space.md }} />
            <TimeField
              label="Start"
              value={minutesToClock(settings.quietHours.startMinutes)}
              onChange={(value) => {
                const minutes = clockToMinutes(value);
                if (minutes != null) void apply({ ...settings, quietHours: { ...settings.quietHours, startMinutes: minutes } });
              }}
            />
            <View style={{ height: space.sm }} />
            <TimeField
              label="End"
              value={minutesToClock(settings.quietHours.endMinutes)}
              onChange={(value) => {
                const minutes = clockToMinutes(value);
                if (minutes != null) void apply({ ...settings, quietHours: { ...settings.quietHours, endMinutes: minutes } });
              }}
            />
            {errorFor("quietHours") ? <AppText variant="caption" color={colors.accent}>{errorFor("quietHours")}</AppText> : null}
            <AppText variant="caption" color={colors.textSecondary}>
              Quiet hours apply to workout, hydration, goal, and sleep reminders. Explicit wake alarms use separate
              smart-alarm settings and are not silenced by quiet hours.
            </AppText>
          </>
        ) : null}
      </Card>

      <View style={{ height: space.lg }} />
      <AppText variant="h3">Sleep reminders</AppText>
      <AppText variant="caption" color={colors.textSecondary}>
        Off by default. Wake-up alarms are configured under Sleep → Smart alarm.
      </AppText>
      <View style={{ height: space.md }} />
      <SleepCategoryCard
        title="Bedtime reminder"
        section="bedtime"
        help="A clock reminder only — not a measurement that you fell asleep."
        settings={settings}
        onToggle={(section, enabled) => void toggleSection(section, enabled)}
        onApply={(next) => void apply(next)}
        secondaryColor={colors.textSecondary}
      />
      <View style={{ height: space.md }} />
      <SleepCategoryCard
        title="Wind-down reminder"
        section="windDown"
        help="Optional quieter hour before bed."
        settings={settings}
        onToggle={(section, enabled) => void toggleSection(section, enabled)}
        onApply={(next) => void apply(next)}
        secondaryColor={colors.textSecondary}
      />
      <View style={{ height: space.md }} />
      <SleepCategoryCard
        title="Sleep-goal reminder"
        section="sleepGoal"
        help="Skipped for today when last night already met your sleep target."
        settings={settings}
        onToggle={(section, enabled) => void toggleSection(section, enabled)}
        onApply={(next) => void apply(next)}
        secondaryColor={colors.textSecondary}
      />
      <View style={{ height: space.md }} />
      <SleepCategoryCard
        title="Morning sleep summary"
        section="morningSummary"
        help="Opens Sleep so you can review real notes or health-store data."
        settings={settings}
        onToggle={(section, enabled) => void toggleSection(section, enabled)}
        onApply={(next) => void apply(next)}
        secondaryColor={colors.textSecondary}
      />
      <View style={{ height: space.md }} />
      <SleepCategoryCard
        title="Incomplete-session reminder"
        section="incompleteSession"
        help="Only schedules while a Start Sleep session is still active."
        settings={settings}
        onToggle={(section, enabled) => void toggleSection(section, enabled)}
        onApply={(next) => void apply(next)}
        secondaryColor={colors.textSecondary}
      />
      <View style={{ height: space.md }} />
      <SleepCategoryCard
        title="Sleep-consistency reminder"
        section="sleepConsistency"
        help="A gentle nudge — not a clinical assessment."
        settings={settings}
        onToggle={(section, enabled) => void toggleSection(section, enabled)}
        onApply={(next) => void apply(next)}
        secondaryColor={colors.textSecondary}
      />

      <View style={{ height: space.lg }} />
      <Button label="Smart alarm" tone="secondary" onPress={() => router.push("/sleep-alarm" as Parameters<typeof router.push>[0])} />
      <View style={{ height: space.sm }} />
      <Button label="Reset to defaults" tone="secondary" onPress={() => void apply(defaultReminderSettings())} />
      <View style={{ height: space.sm }} />
      <Button label="Back" tone="ghost" onPress={() => router.back()} />
    </Screen>
  );
}
