import { useMemo, useState } from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";
import { rankStarterPrograms } from "@vitacore/domain";
import { GlassButton, GlassCard } from "@/components/glass";
import { ProfileHeader } from "@/components/profile-header";
import { AppText, Screen } from "@/components/ui";
import { useAppState } from "@/data/app-state";
import { createWorkout } from "@/data/logs";
import { exercises } from "@/exercises/catalog";
import { starterPrograms } from "@/programs/starters";
import { space } from "@/design/tokens";
import { useTheme } from "@/design/theme";

export default function ProgramsScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { profile } = useAppState();
  const [starting, setStarting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const ranked = useMemo(
    () =>
      rankStarterPrograms(starterPrograms, {
        goal: profile?.goal ?? null,
        fitnessLevel: profile?.fitnessLevel ?? null,
        workoutPreference: profile?.workoutPreference ?? null,
      }),
    [profile],
  );

  const list = ranked.length > 0 ? ranked : starterPrograms;

  async function startDay(programId: string, dayIndex: number, exerciseIds: string[]) {
    const first = exercises.find((item) => item.id === exerciseIds[0]);
    if (!first) {
      setError("That program day has no matching exercises in the catalog.");
      return;
    }
    setStarting(`${programId}:${dayIndex}`);
    setError(null);
    try {
      const id = await createWorkout();
      router.push(`/workout/${id}?exercise=${first.id}`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not start this program day.");
      setStarting(null);
    }
  }

  return (
    <Screen>
      <GlassButton label="Back" tone="ghost" onPress={() => router.back()} />
      <ProfileHeader eyebrow="Starter programs" title="Begin where you are" />
      <View style={{ height: space.sm }} />
      <AppText variant="small" color={colors.textSecondary}>
        Ranked from your onboarding goal, experience, and workout preference. These use the original text exercise
        library — no licensed video.
      </AppText>
      <View style={{ height: space.lg }} />
      {list.map((program) => (
        <GlassCard key={program.id} style={{ marginBottom: space.lg }}>
          <AppText variant="h2">{program.title}</AppText>
          <AppText variant="small" color={colors.textSecondary}>
            {program.summary}
          </AppText>
          <View style={{ height: space.md }} />
          {program.days.map((day, index) => (
            <View key={day.title} style={{ marginBottom: space.sm, gap: 6 }}>
              <AppText variant="label">{day.title}</AppText>
              <AppText variant="caption" color={colors.textMuted}>
                {day.exerciseIds
                  .map((id) => exercises.find((item) => item.id === id)?.name ?? id)
                  .join(" · ")}
              </AppText>
              <GlassButton
                label={starting === `${program.id}:${index}` ? "Starting…" : "Start this day"}
                tone="secondary"
                disabled={starting != null}
                onPress={() => void startDay(program.id, index, day.exerciseIds)}
              />
            </View>
          ))}
        </GlassCard>
      ))}
      {error ? <AppText variant="small">{error}</AppText> : null}
    </Screen>
  );
}
