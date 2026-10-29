import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, View } from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import {
  buildWorkoutShareSummary,
  deviceTimeZone,
  formatWeight,
  isPersonalRecord,
  localDay,
  priorBestWeightKg,
  workoutStreak,
} from "@vitacore/domain";
import { brandConfig } from "@vitacore/brand";
import { ConfettiBurst } from "@/components/confetti-burst";
import { ExerciseCueCard, ExerciseMediaPanel, MuscleTags } from "@/components/exercise-media";
import { GlassButton, GlassCard } from "@/components/glass";
import { ProfileHeader } from "@/components/profile-header";
import { AppText, LoadingState, ProgressBar, Screen, TextField } from "@/components/ui";
import { addSet, finishWorkout, loadActivityDays, priorSetsForExercise, setsForSession, workoutSessionById } from "@/data/logs";
import { exercises, getExercise } from "@/exercises/catalog";
import { shareWorkoutText } from "@/lib/shareWorkout";
import { successHaptic } from "@/lib/haptics";
import { useAppState } from "@/data/app-state";
import { radius, space } from "@/design/tokens";
import { useTheme } from "@/design/theme";

const DEFAULT_TARGET_SETS = 3;

function parseOptionalNumber(raw: string): { ok: true; value: number | null } | { ok: false; reason: string } {
  const trimmed = raw.trim();
  if (!trimmed) return { ok: true, value: null };
  const value = Number(trimmed);
  if (!Number.isFinite(value) || value < 0) return { ok: false, reason: "Enter a valid non-negative number." };
  return { ok: true, value };
}

export default function WorkoutSessionScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { id, exercise: exerciseParam } = useLocalSearchParams<{ id: string; exercise?: string }>();
  const { haptics, profile } = useAppState();
  const exerciseId = typeof exerciseParam === "string" && exerciseParam.length > 0 ? exerciseParam : (exercises[0]?.id ?? "squat");
  const selected = getExercise(exerciseId) ?? exercises[0];
  const [reps, setReps] = useState("8");
  const [weight, setWeight] = useState("");
  const [sets, setSets] = useState<Awaited<ReturnType<typeof setsForSession>>>([]);
  const [endedAt, setEndedAt] = useState<string | null>(null);
  const [rest, setRest] = useState<number | null>(null);
  const [showCues, setShowCues] = useState(true);
  const [finishing, setFinishing] = useState(false);
  const [adding, setAdding] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [prNames, setPrNames] = useState<string[]>([]);
  const [celebrate, setCelebrate] = useState(false);
  const [streakCurrent, setStreakCurrent] = useState<number | null>(null);
  const [shareMessage, setShareMessage] = useState<string | null>(null);
  const units = profile?.unitSystem ?? "metric";
  const finished = endedAt != null;

  const setsForSelected = useMemo(
    () => sets.filter((set) => set.exercise_name === selected?.name),
    [sets, selected],
  );
  const completedForSelected = setsForSelected.length;
  const progress = Math.min(1, completedForSelected / DEFAULT_TARGET_SETS);

  const load = useCallback(() => {
    if (!id) {
      setLoading(false);
      return;
    }
    void Promise.all([setsForSession(id), workoutSessionById(id)]).then(([setRows, session]) => {
      setSets(setRows);
      setEndedAt(session?.ended_at ?? null);
      setLoading(false);
    });
  }, [id]);
  useFocusEffect(load);

  const resting = rest != null;
  useEffect(() => {
    if (!resting) return;
    const timer = setInterval(() => {
      setRest((current) => (current == null || current <= 1 ? null : current - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [resting]);

  useEffect(() => {
    if (!celebrate) return;
    const timer = setTimeout(() => setCelebrate(false), 1400);
    return () => clearTimeout(timer);
  }, [celebrate]);

  if (loading || !selected) {
    return (
      <Screen>
        <LoadingState label="Opening this session…" />
      </Screen>
    );
  }

  return (
    <Screen>
      <ConfettiBurst active={celebrate} />
      <ProfileHeader title={selected.name} eyebrow={finished ? "Finished session" : "Active session"} />
      <View style={{ height: space.sm }} />
      <AppText variant="caption" color={colors.textSecondary}>
        Offline-safe · sets save to this device immediately
      </AppText>
      <View style={{ height: space.md }} />
      <MuscleTags primary={selected.primaryMuscle} secondary={selected.secondaryMuscles} groups={selected.muscleGroups} />
      <View style={{ height: space.md }} />
      <ExerciseMediaPanel exercise={selected} />
      <View style={{ height: space.md }} />
      <GlassButton
        label={showCues ? "Hide setup & cues" : "Show setup, breathing & tempo"}
        tone="ghost"
        onPress={() => setShowCues((value) => !value)}
      />
      {showCues ? (
        <View style={{ marginTop: space.md }}>
          <ExerciseCueCard exercise={selected} />
        </View>
      ) : null}
      <View style={{ height: space.lg }} />
      <GlassCard>
        <AppText variant="label">Session progress</AppText>
        <AppText variant="h3">
          {completedForSelected} / {DEFAULT_TARGET_SETS} sets on {selected.name}
        </AppText>
        <View style={{ height: space.sm }} />
        <ProgressBar progress={progress} />
        <AppText variant="caption" color={colors.textMuted}>
          Target is a guide only. Finish whenever the session is done.
        </AppText>
      </GlassCard>
      <View style={{ height: space.lg }} />
      <AppText variant="label">Switch exercise</AppText>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: space.sm }}>
        {exercises.map((item) => {
          const active = item.id === selected.id;
          return (
            <Pressable
              key={item.id}
              disabled={finished}
              onPress={() => {
                router.setParams({ exercise: item.id });
              }}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 8,
                borderRadius: radius.pill,
                borderWidth: 1,
                borderColor: active ? colors.accent : colors.glassBorder,
                backgroundColor: active ? colors.accentMuted : colors.glassFill,
                opacity: finished ? 0.6 : 1,
              }}
            >
              <AppText variant="caption" color={active ? colors.accent : colors.text}>
                {item.name}
              </AppText>
            </Pressable>
          );
        })}
      </View>
      <View style={{ height: space.lg }} />
      {!finished ? (
        <>
          <TextField label="Reps" value={reps} onChangeText={setReps} keyboardType="numeric" />
          <View style={{ height: space.sm }} />
          <TextField
            label={units === "imperial" ? "Weight (lb)" : "Weight (kg)"}
            value={weight}
            onChangeText={setWeight}
            keyboardType="decimal-pad"
          />
          <View style={{ height: space.md }} />
          <GlassButton
            label={adding ? "Saving set…" : "Complete set"}
            disabled={adding || finishing}
            onPress={() => {
              if (!id || adding || finishing) return;
              const repsParsed = parseOptionalNumber(reps);
              const weightParsed = parseOptionalNumber(weight);
              if (!repsParsed.ok) {
                setError(repsParsed.reason);
                return;
              }
              if (!weightParsed.ok) {
                setError(weightParsed.reason);
                return;
              }
              const kg =
                units === "imperial" && weightParsed.value != null
                  ? weightParsed.value / 2.2046226218
                  : weightParsed.value;
              setAdding(true);
              setError(null);
              void priorSetsForExercise(selected.name, id)
                .then((prior) => {
                  const priorBest = priorBestWeightKg(
                    [
                      ...prior.map((row) => ({
                        exerciseName: row.exercise_name,
                        weightKg: row.weight_kg,
                        reps: row.reps,
                      })),
                      ...setsForSelected.map((row) => ({
                        exerciseName: row.exercise_name,
                        weightKg: row.weight_kg,
                        reps: row.reps,
                      })),
                    ],
                    selected.name,
                  );
                  const pr = isPersonalRecord({
                    exerciseName: selected.name,
                    weightKg: kg,
                    priorBestKg: priorBest,
                  });
                  return addSet({
                    sessionId: id,
                    exerciseId: selected.id,
                    exerciseName: selected.name,
                    reps: repsParsed.value == null ? null : Math.round(repsParsed.value),
                    weightKg: kg,
                  }).then(() => pr);
                })
                .then((pr) => {
                  void successHaptic(haptics);
                  if (pr) {
                    setPrNames((current) => (current.includes(selected.name) ? current : [...current, selected.name]));
                    setCelebrate(true);
                  }
                  setRest(90);
                  load();
                })
                .catch((reason: unknown) => {
                  setError(reason instanceof Error ? reason.message : "This set could not be saved.");
                })
                .finally(() => setAdding(false));
            }}
          />
          {rest != null ? (
            <GlassCard style={{ marginTop: space.md }}>
              <AppText variant="label">Rest timer</AppText>
              <AppText variant="metric">{rest}s</AppText>
              <AppText variant="small" color={colors.textSecondary}>
                Suggested rest after the last set. Skip anytime.
              </AppText>
              <View style={{ height: space.sm }} />
              <GlassButton label="Skip rest" tone="secondary" onPress={() => setRest(null)} />
            </GlassCard>
          ) : null}
        </>
      ) : null}
      {prNames.length > 0 ? (
        <View style={{ marginTop: space.md }}>
          <GlassCard>
            <AppText variant="label">Personal records this session</AppText>
            <AppText variant="small">{prNames.join(" · ")}</AppText>
          </GlassCard>
        </View>
      ) : null}
      <View style={{ height: space.lg }} />
      <AppText variant="label">Logged sets</AppText>
      {sets.length === 0 ? (
        <AppText variant="small" color={colors.textSecondary}>
          No sets yet. Complete a set to keep progress on this device.
        </AppText>
      ) : (
        sets.map((set) => (
          <AppText key={set.id} variant="small">
            {set.exercise_name} set {set.set_index} · {set.reps ?? "—"} reps ·{" "}
            {set.weight_kg == null ? "—" : formatWeight(set.weight_kg, units)}
          </AppText>
        ))
      )}
      <View style={{ height: space.lg }} />
      {error ? (
        <AppText variant="small" color={colors.accent}>
          {error}
        </AppText>
      ) : null}
      {shareMessage ? <AppText variant="small">{shareMessage}</AppText> : null}
      {!finished ? (
        <GlassButton
          label={finishing ? "Saving…" : "Finish session"}
          tone="secondary"
          disabled={finishing || adding}
          onPress={() => {
            if (!id || finishing || adding) return;
            setFinishing(true);
            setError(null);
            void finishWorkout(id)
              .then(async () => {
                void successHaptic(haptics);
                const zone = deviceTimeZone();
                const today = localDay(new Date(), zone);
                const days = await loadActivityDays(zone);
                const streak = workoutStreak([...days, today], today);
                setStreakCurrent(streak.current);
                setEndedAt(new Date().toISOString());
                setFinishing(false);
                load();
              })
              .catch((reason: unknown) => {
                setFinishing(false);
                setError(reason instanceof Error ? reason.message : "This session could not be finished.");
              });
          }}
        />
      ) : (
        <View style={{ gap: space.sm }}>
          {streakCurrent != null && streakCurrent > 0 ? (
            <GlassCard>
              <AppText variant="label">Streak</AppText>
              <AppText variant="h2">
                {streakCurrent} day{streakCurrent === 1 ? "" : "s"}
              </AppText>
            </GlassCard>
          ) : null}
          <GlassButton
            label="Share summary"
            onPress={() => {
              const text = buildWorkoutShareSummary({
                brandName: brandConfig.name,
                title: `${selected.name} session`,
                finishedAtLabel: new Date().toLocaleDateString(),
                sets: sets.map((set) => ({
                  exerciseName: set.exercise_name,
                  setIndex: set.set_index,
                  reps: set.reps,
                  weightLabel: set.weight_kg == null ? null : formatWeight(set.weight_kg, units),
                })),
                streakCurrent,
                personalRecords: prNames,
              });
              void shareWorkoutText(text).then((result) => {
                setShareMessage(result.ok ? "Share sheet opened." : result.message);
              });
            }}
          />
          <GlassButton label="Back to workouts" tone="secondary" onPress={() => router.replace("/workout")} />
        </View>
      )}
    </Screen>
  );
}
