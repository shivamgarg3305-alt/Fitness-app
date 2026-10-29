import { useCallback, useEffect, useMemo, useState } from "react";
import { View } from "react-native";
import { brandConfig } from "@vitacore/brand";
import {
  canContinueOnboardingStep,
  clearStepSkip,
  createEmptyOnboardingDraft,
  estimateDailyCalories,
  isOnboardingStepOptional,
  markStepSkipped,
  onboardingStepAt,
  parseOnboardingDraft,
  serializeOnboardingDraft,
  type ActivityLevel,
  type BodyGoal,
  type DietaryPreference,
  type FitnessLevel,
  type OnboardingDraft,
  type OnboardingStepId,
  type WorkoutFrequency,
  type WorkoutPreference,
} from "@vitacore/domain";
import { AgeWheel, HeightRuler, WearablePrefCard, WeightDial } from "@/components/onboarding-controls";
import { GlassButton, GlassCard, GlassHeader, GlassInput } from "@/components/glass";
import { AppText, ChoiceList, Screen, SegmentedControl } from "@/components/ui";
import { useAppState } from "@/data/app-state";
import { readPreference, writePreference } from "@/data/db";
import { recordEvent } from "@/data/logs";
import { createId } from "@/lib/id";
import { copy } from "@/i18n/copy";
import { space } from "@/design/tokens";
import { useTheme } from "@/design/theme";

const DRAFT_KEY = "onboarding_draft";
const EXTRAS_KEY = "onboarding_extras";

export default function OnboardingScreen() {
  const { profile, updateProfile } = useAppState();
  const { colors } = useTheme();
  const [draft, setDraft] = useState<OnboardingDraft>(() => createEmptyOnboardingDraft(profile?.unitSystem ?? "metric"));
  const [hydrated, setHydrated] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [finishing, setFinishing] = useState(false);

  const step = onboardingStepAt(draft.stepIndex);
  const canContinue = canContinueOnboardingStep(draft, step);
  const optional = isOnboardingStepOptional(step);

  useEffect(() => {
    let cancelled = false;
    void readPreference(DRAFT_KEY).then((raw) => {
      if (cancelled) return;
      const parsed = parseOnboardingDraft(raw);
      if (parsed) setDraft(parsed);
      setHydrated(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const persistDraft = useCallback(async (next: OnboardingDraft) => {
    setDraft(next);
    await writePreference(DRAFT_KEY, serializeOnboardingDraft(next));
  }, []);

  const patch = useCallback(
    async (partial: Partial<OnboardingDraft>, clearSkip?: OnboardingStepId) => {
      const base = clearSkip ? clearStepSkip(draft, clearSkip) : draft;
      await persistDraft({ ...base, ...partial });
    },
    [draft, persistDraft],
  );

  const estimate = useMemo(
    () =>
      estimateDailyCalories({
        ageYears: draft.ageYears,
        sex: draft.sex,
        heightCm: draft.heightCm,
        weightKg: draft.weightKg,
        activityLevel: draft.activityLevel,
        goal: draft.goal,
      }),
    [draft],
  );

  async function finish(source: OnboardingDraft = draft) {
    if (finishing) return;
    if (!canContinueOnboardingStep(source, onboardingStepAt(source.stepIndex)) && source.stepIndex < 9) return;
    setFinishing(true);
    setSaveError(null);
    try {
      await recordEvent("onboarding_completed");
      await updateProfile({
        id: profile?.id ?? createId(),
        displayName: source.displayName,
        ageYears: source.ageYears,
        sex: source.sex,
        heightCm: source.heightCm,
        weightKg: source.weightKg,
        fitnessLevel: source.fitnessLevel,
        activityLevel: source.activityLevel,
        goal: source.goal,
        unitSystem: source.unitSystem,
        workoutPreference: source.workoutPreference,
        dietary: source.dietary ?? [],
        sleepTargetMinutes: source.sleepTargetMinutes,
        hydrationTargetMl: source.hydrationTargetMl,
        stepGoal: source.stepGoal,
        onboardingCompletedAt: new Date().toISOString(),
      });
      await writePreference(
        EXTRAS_KEY,
        JSON.stringify({
          workoutFrequency: source.workoutFrequency,
          equipment: source.equipment,
          wearablePreference: source.wearablePreference,
        }),
      );
      await writePreference(DRAFT_KEY, "");
    } catch (reason) {
      setFinishing(false);
      setSaveError(reason instanceof Error ? reason.message : "Profile could not be saved.");
    }
  }

  async function goNext() {
    if (!canContinue || finishing) return;
    if (step === "welcome") void recordEvent("onboarding_started");
    if (draft.stepIndex >= 9) {
      await finish(draft);
      return;
    }
    await persistDraft({ ...draft, stepIndex: draft.stepIndex + 1 });
  }

  async function skip() {
    if (!optional || finishing) return;
    const skipped = markStepSkipped(draft, step);
    if (draft.stepIndex >= 9) {
      await persistDraft(skipped);
      await finish(skipped);
      return;
    }
    await persistDraft({ ...skipped, stepIndex: draft.stepIndex + 1 });
  }

  if (!hydrated) {
    return (
      <Screen>
        <AppText variant="small">Restoring onboarding progress…</AppText>
      </Screen>
    );
  }

  return (
    <Screen>
      <GlassHeader eyebrow={brandConfig.name} title={`${draft.stepIndex + 1} of 10`} />
      <View style={{ height: space.lg }} />

      {step === "welcome" ? (
        <GlassCard>
          <AppText variant="display">Build your baseline.</AppText>
          <View style={{ height: space.sm }} />
          <AppText variant="body" color={colors.textSecondary}>
            Ten short questions personalize goals. Optional steps can be skipped — skipping never invents an answer.
            Measurements stay blank until a real source provides them.
          </AppText>
          <View style={{ height: space.md }} />
          <GlassInput
            label="Display name (optional)"
            value={draft.displayName ?? ""}
            onChangeText={(value) => void patch({ displayName: value.trim() || null })}
            placeholder="Optional"
          />
        </GlassCard>
      ) : null}

      {step === "age" ? (
        <GlassCard>
          <AppText variant="h1">How old are you?</AppText>
          <AppText variant="small" color={colors.textSecondary}>
            Used for the adult calorie estimate only when provided.
          </AppText>
          <View style={{ height: space.md }} />
          <AgeWheel value={draft.ageYears} onChange={(ageYears) => void patch({ ageYears }, "age")} />
        </GlassCard>
      ) : null}

      {step === "height" ? (
        <GlassCard>
          <AppText variant="h1">Height</AppText>
          <View style={{ height: space.sm }} />
          <SegmentedControl
            value={draft.unitSystem}
            onChange={(unitSystem) => void patch({ unitSystem })}
            options={[
              { value: "metric", label: "Metric" },
              { value: "imperial", label: "Imperial" },
            ]}
          />
          <View style={{ height: space.md }} />
          <HeightRuler
            units={draft.unitSystem}
            heightCm={draft.heightCm}
            onChangeCm={(heightCm) => void patch({ heightCm }, "height")}
          />
        </GlassCard>
      ) : null}

      {step === "weight" ? (
        <GlassCard>
          <AppText variant="h1">Weight</AppText>
          <View style={{ height: space.sm }} />
          <SegmentedControl
            value={draft.unitSystem}
            onChange={(unitSystem) => void patch({ unitSystem })}
            options={[
              { value: "metric", label: "kg" },
              { value: "imperial", label: "lb" },
            ]}
          />
          <View style={{ height: space.md }} />
          <WeightDial
            units={draft.unitSystem}
            weightKg={draft.weightKg}
            onChangeKg={(weightKg) => void patch({ weightKg }, "weight")}
          />
        </GlassCard>
      ) : null}

      {step === "goal" ? (
        <GlassCard>
          <AppText variant="h1">Fitness goal</AppText>
          <View style={{ height: space.md }} />
          <ChoiceList
            value={draft.goal}
            onChange={(goal: BodyGoal) => void patch({ goal })}
            options={[
              { value: "maintain", label: "Maintain", detail: "Keep intake near the estimate." },
              { value: "lose", label: "Lose weight", detail: "About 15% under the estimate." },
              { value: "gain", label: "Gain weight", detail: "About 10% over the estimate." },
              { value: "performance", label: "Performance", detail: "A little extra for training." },
            ]}
          />
        </GlassCard>
      ) : null}

      {step === "activity" ? (
        <GlassCard>
          <AppText variant="h1">Daily activity level</AppText>
          <View style={{ height: space.md }} />
          <ChoiceList
            value={draft.activityLevel}
            onChange={(activityLevel: ActivityLevel) => void patch({ activityLevel })}
            options={[
              { value: "sedentary", label: "Mostly seated" },
              { value: "light", label: "Light movement" },
              { value: "moderate", label: "On your feet often" },
              { value: "very", label: "Hard most days" },
              { value: "athlete", label: "Training is the job" },
            ]}
          />
        </GlassCard>
      ) : null}

      {step === "experience" ? (
        <GlassCard>
          <AppText variant="h1">Training experience</AppText>
          <View style={{ height: space.md }} />
          <ChoiceList
            value={draft.fitnessLevel}
            onChange={(fitnessLevel: FitnessLevel) => void patch({ fitnessLevel })}
            options={[
              { value: "beginner", label: "Beginner" },
              { value: "intermediate", label: "Intermediate" },
              { value: "advanced", label: "Advanced" },
            ]}
          />
        </GlassCard>
      ) : null}

      {step === "training" ? (
        <GlassCard>
          <AppText variant="h1">Workouts & equipment</AppText>
          <View style={{ height: space.md }} />
          <AppText variant="label">Preference</AppText>
          <ChoiceList
            value={draft.workoutPreference}
            onChange={(workoutPreference: WorkoutPreference) => void patch({ workoutPreference })}
            options={[
              { value: "strength", label: "Strength" },
              { value: "cardio", label: "Cardio" },
              { value: "mixed", label: "Mixed" },
              { value: "mobility", label: "Mobility" },
            ]}
          />
          <View style={{ height: space.md }} />
          <AppText variant="label">Frequency</AppText>
          <ChoiceList
            value={draft.workoutFrequency}
            onChange={(workoutFrequency: WorkoutFrequency) => void patch({ workoutFrequency })}
            options={[
              { value: "1_2", label: "1–2 days / week" },
              { value: "3_4", label: "3–4 days / week" },
              { value: "5_plus", label: "5+ days / week" },
              { value: "flexible", label: "Flexible" },
            ]}
          />
          <View style={{ height: space.md }} />
          <AppText variant="label">Equipment</AppText>
          <ChoiceList
            value={draft.equipment}
            onChange={(equipment) => void patch({ equipment })}
            options={[
              { value: "none", label: "None / bodyweight" },
              { value: "dumbbells", label: "Dumbbells at home" },
              { value: "bodyweight_bands", label: "Bands / light gear" },
              { value: "full_gym", label: "Full gym" },
            ]}
          />
        </GlassCard>
      ) : null}

      {step === "nutrition" ? (
        <GlassCard>
          <AppText variant="h1">Nutrition preferences</AppText>
          <AppText variant="small" color={colors.textSecondary}>
            Optional. Skip leaves preferences unset — it does not save “none” for you.
          </AppText>
          <View style={{ height: space.md }} />
          <ChoiceList
            value={draft.dietary?.[0] ?? null}
            onChange={(value: DietaryPreference) => void patch({ dietary: [value] }, "nutrition")}
            options={[
              { value: "none", label: "No specific pattern" },
              { value: "vegetarian", label: "Vegetarian" },
              { value: "vegan", label: "Vegan" },
              { value: "pescatarian", label: "Pescatarian" },
              { value: "gluten_free", label: "Gluten free" },
              { value: "dairy_free", label: "Dairy free" },
            ]}
          />
        </GlassCard>
      ) : null}

      {step === "sleep" ? (
        <View style={{ gap: space.lg }}>
          <GlassCard>
            <AppText variant="h1">Sleep schedule & targets</AppText>
            <AppText variant="small" color={colors.textSecondary}>
              Goals only — not measurements. Skip leaves them unset.
            </AppText>
            <View style={{ height: space.md }} />
            <GlassInput
              label="Sleep hours target"
              value={draft.sleepTargetMinutes != null ? String(draft.sleepTargetMinutes / 60) : ""}
              onChangeText={(value) => {
                const hours = Number(value);
                void patch(
                  {
                    sleepTargetMinutes: Number.isFinite(hours) && hours > 0 ? Math.round(hours * 60) : null,
                  },
                  "sleep",
                );
              }}
              keyboardType="decimal-pad"
              placeholder="e.g. 8"
            />
            <View style={{ height: space.sm }} />
            <GlassInput
              label="Water target (ml)"
              value={draft.hydrationTargetMl != null ? String(draft.hydrationTargetMl) : ""}
              onChangeText={(value) => {
                const ml = Number(value);
                void patch(
                  { hydrationTargetMl: Number.isFinite(ml) && ml > 0 ? Math.round(ml) : null },
                  "sleep",
                );
              }}
              keyboardType="numeric"
              placeholder="e.g. 2000"
            />
            <View style={{ height: space.sm }} />
            <GlassInput
              label="Step goal"
              value={draft.stepGoal != null ? String(draft.stepGoal) : ""}
              onChangeText={(value) => {
                const steps = Number(value);
                void patch({ stepGoal: Number.isFinite(steps) && steps > 0 ? Math.round(steps) : null }, "sleep");
              }}
              keyboardType="numeric"
              placeholder="e.g. 8000"
            />
          </GlassCard>
          <WearablePrefCard
            value={draft.wearablePreference}
            onChange={(wearablePreference) => void patch({ wearablePreference }, "sleep")}
          />
          <GlassCard>
            <AppText variant="small">
              {estimate.status === "estimated"
                ? `Estimated intake ${estimate.kcal.toLocaleString("en-US")} kcal. ${estimate.disclaimer}`
                : estimate.reason === "adult_formula_does_not_apply"
                  ? copy.calorieMinor
                  : "Calorie estimate appears when age, body size, activity, and goal are present."}
            </AppText>
          </GlassCard>
        </View>
      ) : null}

      <View style={{ height: space.xl }} />
      {saveError ? <AppText variant="small">{saveError}</AppText> : null}
      <GlassButton
        label={draft.stepIndex >= 9 ? (finishing ? "Saving…" : "Finish") : "Continue"}
        disabled={!canContinue || finishing}
        onPress={() => void goNext()}
      />
      {optional ? (
        <>
          <View style={{ height: space.sm }} />
          <GlassButton label="Skip" tone="ghost" disabled={finishing} onPress={() => void skip()} />
        </>
      ) : null}
      {draft.stepIndex > 0 ? (
        <>
          <View style={{ height: space.sm }} />
          <GlassButton
            label="Back"
            tone="secondary"
            disabled={finishing}
            onPress={() => void persistDraft({ ...draft, stepIndex: draft.stepIndex - 1 })}
          />
        </>
      ) : null}
    </Screen>
  );
}
