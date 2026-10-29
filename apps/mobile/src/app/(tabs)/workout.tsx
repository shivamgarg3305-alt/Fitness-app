import { useCallback, useState } from "react";
import { View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { deviceTimeZone, formatWeight, localDay, rankStarterPrograms, workoutStreak } from "@vitacore/domain";
import { GlassButton, GlassCard } from "@/components/glass";
import { ProfileHeader } from "@/components/profile-header";
import { AppText, Screen } from "@/components/ui";
import { useAppState } from "@/data/app-state";
import { loadActivityDays, loadLocalHistory } from "@/data/logs";
import { starterPrograms } from "@/programs/starters";
import { useTheme } from "@/design/theme";
import { space } from "@/design/tokens";

const routes = [
  { kind: "walk", label: "Walk" },
  { kind: "run", label: "Run" },
  { kind: "cycle", label: "Cycle" },
  { kind: "hike", label: "Hike" },
] as const;

export default function WorkoutScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { profile } = useAppState();
  const units = profile?.unitSystem ?? "metric";
  const [records, setRecords] = useState<Awaited<ReturnType<typeof loadLocalHistory>>["records"]>([]);
  const [streak, setStreak] = useState<{ current: number; longest: number; includesToday: boolean } | null>(null);

  useFocusEffect(
    useCallback(() => {
      const zone = deviceTimeZone();
      void Promise.all([loadLocalHistory(zone), loadActivityDays(zone)]).then(([history, days]) => {
        setRecords(history.records);
        setStreak(workoutStreak(days, localDay(new Date(), zone)));
      });
    }, []),
  );

  const topProgram = rankStarterPrograms(starterPrograms, {
    goal: profile?.goal ?? null,
    fitnessLevel: profile?.fitnessLevel ?? null,
    workoutPreference: profile?.workoutPreference ?? null,
  })[0];

  return (
    <Screen>
      <ProfileHeader title="Workout" />
      <View style={{ height: space.sm }} />
      <AppText variant="small" color={colors.textSecondary}>
        Strength uses an original text library. Walks, runs, rides, and hikes record a real GPS route on iOS and Android.
      </AppText>
      <View style={{ height: space.lg }} />
      <GlassCard>
        <AppText variant="label">Workout streak</AppText>
        <AppText variant="h2">
          {streak && streak.current > 0 ? `${streak.current} day${streak.current === 1 ? "" : "s"}` : "No active streak"}
        </AppText>
        <AppText variant="small" color={colors.textSecondary}>
          {streak
            ? `Longest ${streak.longest}. Counts finished strength sessions and GPS activities on this device${
                streak.includesToday ? " · includes today" : ""
              }.`
            : "Finish a session to start a streak."}
        </AppText>
      </GlassCard>
      <View style={{ height: space.lg }} />
      <GlassCard>
        <AppText variant="label">Starter program</AppText>
        <View style={{ height: space.sm }} />
        <AppText variant="h3">{topProgram?.title ?? "Browse programs"}</AppText>
        <AppText variant="small" color={colors.textSecondary}>
          {topProgram?.summary ?? "Programs use your onboarding goal and experience when available."}
        </AppText>
        <View style={{ height: space.md }} />
        <GlassButton label="Open starter programs" onPress={() => router.push("/programs" as Parameters<typeof router.push>[0])} />
      </GlassCard>
      <View style={{ height: space.lg }} />
      <GlassCard>
        <AppText variant="label">Strength</AppText>
        <View style={{ height: space.sm }} />
        <AppText variant="small" color={colors.textSecondary}>
          Sets, reps, weight, rest timer, PR celebration, and a shareable summary. No licensed workout video is bundled.
        </AppText>
        <View style={{ height: space.md }} />
        <GlassButton label="Browse exercises" onPress={() => router.push("/exercises")} />
      </GlassCard>
      <View style={{ height: space.lg }} />
      <GlassCard>
        <AppText variant="label">Cardio route</AppText>
        <View style={{ height: space.sm }} />
        <AppText variant="small" color={colors.textSecondary}>
          Distance, pace, and elevation come from the device. The route is drawn as an outline, and on a base map once a tile style is configured.
        </AppText>
        <View style={{ height: space.md, gap: space.sm }}>
          {routes.map((item) => (
            <GlassButton key={item.kind} label={item.label} tone="secondary" onPress={() => router.push(`/record?kind=${item.kind}`)} />
          ))}
        </View>
      </GlassCard>
      <View style={{ height: space.lg }} />
      <GlassCard>
        <AppText variant="label">Personal records</AppText>
        <View style={{ height: space.sm }} />
        {records.length === 0 ? (
          <AppText variant="small" color={colors.textSecondary}>The heaviest logged weight for each exercise shows up here.</AppText>
        ) : (
          records.slice(0, 5).map((record) => (
            <AppText key={record.exerciseName} variant="small">
              {record.exerciseName} · {formatWeight(record.weightKg, units)}
              {record.reps != null ? ` · ${record.reps} reps` : ""}
            </AppText>
          ))
        )}
      </GlassCard>
      <View style={{ height: space.lg }} />
      <GlassButton label="Reminders" tone="ghost" onPress={() => router.push("/reminders")} />
      <View style={{ height: space.sm }} />
      <GlassButton label="Ask the coach" tone="ghost" onPress={() => router.push("/coach")} />
    </Screen>
  );
}
