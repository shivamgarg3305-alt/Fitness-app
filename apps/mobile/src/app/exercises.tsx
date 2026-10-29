import { useMemo, useState } from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";
import { ExerciseCueCard, ExerciseMediaPanel, MuscleTags } from "@/components/exercise-media";
import { GlassButton, GlassCard } from "@/components/glass";
import { ProfileHeader } from "@/components/profile-header";
import { AppText, FilterChips, Screen, SearchBar } from "@/components/ui";
import { createWorkout } from "@/data/logs";
import { exercises, muscleFilterOptions } from "@/exercises/catalog";
import { space } from "@/design/tokens";
import { useTheme } from "@/design/theme";

export default function ExercisesScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const [query, setQuery] = useState("");
  const [equipment, setEquipment] = useState<string | null>(null);
  const [muscle, setMuscle] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(exercises[0]?.id ?? null);
  const [startingId, setStartingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const equipmentOptions = [...new Set(exercises.map((item) => item.equipment))];
  const muscleOptions = muscleFilterOptions();
  const filtered = useMemo(
    () =>
      exercises.filter((item) => {
        const q = query.trim().toLowerCase();
        const matchesQuery =
          !q ||
          item.name.toLowerCase().includes(q) ||
          item.primaryMuscle.toLowerCase().includes(q) ||
          item.formCues.some((cue) => cue.toLowerCase().includes(q));
        const matchesEquipment = equipment == null || item.equipment === equipment;
        const matchesMuscle =
          muscle == null ||
          item.primaryMuscle === muscle ||
          item.muscleGroups.includes(muscle) ||
          item.secondaryMuscles.includes(muscle);
        return matchesQuery && matchesEquipment && matchesMuscle;
      }),
    [equipment, muscle, query],
  );

  return (
    <Screen>
      <ProfileHeader title="Exercises" />
      <View style={{ height: space.sm }} />
      <AppText variant="small" color={colors.textSecondary}>
        Original text library with setup, form cues, breathing, and tempo. Demonstration media is not bundled — placeholders stay honest.
      </AppText>
      <View style={{ height: space.md }} />
      <SearchBar value={query} onChangeText={setQuery} placeholder="Search name, muscle, or cue" />
      <View style={{ height: space.md }} />
      <AppText variant="label">Equipment</AppText>
      <FilterChips options={equipmentOptions} value={equipment} onChange={setEquipment} />
      <View style={{ height: space.sm }} />
      <AppText variant="label">Muscle</AppText>
      <FilterChips options={muscleOptions} value={muscle} onChange={setMuscle} />
      <View style={{ height: space.lg }} />
      {error ? <AppText variant="small" color={colors.accent}>{error}</AppText> : null}
      {filtered.map((item) => {
        const open = expandedId === item.id;
        return (
          <GlassCard key={item.id} style={{ marginBottom: space.lg }}>
            <AppText variant="h3">{item.name}</AppText>
            <AppText variant="caption" color={colors.textMuted}>
              {item.equipment} · {item.difficulty}
              {item.tempo ? ` · tempo ${item.tempo}` : ""}
            </AppText>
            <View style={{ height: space.sm }} />
            <MuscleTags primary={item.primaryMuscle} secondary={item.secondaryMuscles} groups={item.muscleGroups} />
            <View style={{ height: space.md }} />
            <GlassButton
              label={open ? "Hide details" : "Show cues & placeholder"}
              tone="ghost"
              onPress={() => setExpandedId(open ? null : item.id)}
            />
            {open ? (
              <View style={{ marginTop: space.md, gap: space.md }}>
                <ExerciseMediaPanel exercise={item} />
                <ExerciseCueCard exercise={item} />
              </View>
            ) : (
              <AppText variant="small" color={colors.textSecondary} style={{ marginTop: space.sm }}>
                {item.formCues.slice(0, 2).join(" · ")}
              </AppText>
            )}
            <View style={{ height: space.md }} />
            <GlassButton
              label={startingId === item.id ? "Starting…" : "Start session with this"}
              tone="secondary"
              disabled={startingId != null}
              onPress={() => {
                if (startingId) return;
                setStartingId(item.id);
                setError(null);
                void createWorkout()
                  .then((id) => router.push(`/workout/${id}?exercise=${item.id}`))
                  .catch((reason: unknown) => {
                    setStartingId(null);
                    setError(reason instanceof Error ? reason.message : "A workout could not be started.");
                  });
              }}
            />
          </GlassCard>
        );
      })}
    </Screen>
  );
}
