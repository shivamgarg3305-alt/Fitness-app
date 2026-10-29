import type {
  ActivityLevel,
  BodyGoal,
  DietaryPreference,
  FitnessLevel,
  SexForEstimate,
  UnitSystem,
  WorkoutPreference,
} from "./profile";

/** Ordered onboarding steps for the signed-in first-run wizard. */
export const ONBOARDING_STEPS = [
  "welcome",
  "age",
  "height",
  "weight",
  "goal",
  "activity",
  "experience",
  "training",
  "nutrition",
  "sleep",
] as const;

export type OnboardingStepId = (typeof ONBOARDING_STEPS)[number];

export type WorkoutFrequency = "1_2" | "3_4" | "5_plus" | "flexible";

export type EquipmentAvailability = "none" | "dumbbells" | "full_gym" | "bodyweight_bands";

export type WearablePreference = "apple_health" | "health_connect" | "none_yet" | "unsure";

export type OnboardingDraft = {
  stepIndex: number;
  displayName: string | null;
  ageYears: number | null;
  sex: SexForEstimate | null;
  unitSystem: UnitSystem;
  heightCm: number | null;
  weightKg: number | null;
  goal: BodyGoal | null;
  activityLevel: ActivityLevel | null;
  fitnessLevel: FitnessLevel | null;
  workoutPreference: WorkoutPreference | null;
  workoutFrequency: WorkoutFrequency | null;
  equipment: EquipmentAvailability | null;
  dietary: DietaryPreference[] | null;
  sleepTargetMinutes: number | null;
  hydrationTargetMl: number | null;
  stepGoal: number | null;
  wearablePreference: WearablePreference | null;
  /** Steps the user explicitly skipped — answers stay null/empty, never invented. */
  skipped: OnboardingStepId[];
};

export function createEmptyOnboardingDraft(unitSystem: UnitSystem = "metric"): OnboardingDraft {
  return {
    stepIndex: 0,
    displayName: null,
    ageYears: null,
    sex: null,
    unitSystem,
    heightCm: null,
    weightKg: null,
    goal: null,
    activityLevel: null,
    fitnessLevel: null,
    workoutPreference: null,
    workoutFrequency: null,
    equipment: null,
    dietary: null,
    sleepTargetMinutes: null,
    hydrationTargetMl: null,
    stepGoal: null,
    wearablePreference: null,
    skipped: [],
  };
}

export function clampOnboardingStepIndex(index: number): number {
  if (!Number.isFinite(index)) return 0;
  return Math.max(0, Math.min(ONBOARDING_STEPS.length - 1, Math.trunc(index)));
}

export function onboardingStepAt(index: number): OnboardingStepId {
  return ONBOARDING_STEPS[clampOnboardingStepIndex(index)] ?? "welcome";
}

export type StepAnswerState = "answered" | "skipped" | "empty";

export function stepAnswerState(draft: OnboardingDraft, step: OnboardingStepId): StepAnswerState {
  if (draft.skipped.includes(step)) return "skipped";
  switch (step) {
    case "welcome":
      return "answered";
    case "age":
      return draft.ageYears != null && draft.ageYears >= 13 && draft.ageYears <= 100 ? "answered" : "empty";
    case "height":
      return draft.heightCm != null && draft.heightCm >= 90 && draft.heightCm <= 250 ? "answered" : "empty";
    case "weight":
      return draft.weightKg != null && draft.weightKg >= 30 && draft.weightKg <= 300 ? "answered" : "empty";
    case "goal":
      return draft.goal != null ? "answered" : "empty";
    case "activity":
      return draft.activityLevel != null ? "answered" : "empty";
    case "experience":
      return draft.fitnessLevel != null ? "answered" : "empty";
    case "training":
      return draft.workoutPreference != null ? "answered" : "empty";
    case "nutrition":
      return draft.dietary != null ? "answered" : "empty";
    case "sleep":
      return draft.sleepTargetMinutes != null || draft.wearablePreference != null ? "answered" : "empty";
    default:
      return "empty";
  }
}

/** Required steps must be answered; optional steps may be skipped. */
export function isOnboardingStepOptional(step: OnboardingStepId): boolean {
  return step === "age" || step === "height" || step === "weight" || step === "nutrition" || step === "sleep";
}

export function canContinueOnboardingStep(draft: OnboardingDraft, step: OnboardingStepId): boolean {
  const state = stepAnswerState(draft, step);
  if (state === "answered" || state === "skipped") return true;
  // Welcome is always continue-able.
  return step === "welcome";
}

export function markStepSkipped(draft: OnboardingDraft, step: OnboardingStepId): OnboardingDraft {
  if (!isOnboardingStepOptional(step)) return draft;
  const skipped = draft.skipped.includes(step) ? draft.skipped : [...draft.skipped, step];
  const next: OnboardingDraft = { ...draft, skipped };
  // Clearing invented defaults: skip leaves the field unset rather than writing a placeholder.
  switch (step) {
    case "age":
      next.ageYears = null;
      break;
    case "height":
      next.heightCm = null;
      break;
    case "weight":
      next.weightKg = null;
      break;
    case "nutrition":
      next.dietary = null;
      break;
    case "sleep":
      next.sleepTargetMinutes = null;
      next.hydrationTargetMl = null;
      next.stepGoal = null;
      next.wearablePreference = null;
      break;
    default:
      break;
  }
  return next;
}

export function clearStepSkip(draft: OnboardingDraft, step: OnboardingStepId): OnboardingDraft {
  if (!draft.skipped.includes(step)) return draft;
  return { ...draft, skipped: draft.skipped.filter((item) => item !== step) };
}

export function parseOnboardingDraft(raw: string | null): OnboardingDraft | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<OnboardingDraft>;
    if (!parsed || typeof parsed !== "object") return null;
    const base = createEmptyOnboardingDraft(parsed.unitSystem === "imperial" ? "imperial" : "metric");
    return {
      ...base,
      ...parsed,
      stepIndex: clampOnboardingStepIndex(typeof parsed.stepIndex === "number" ? parsed.stepIndex : 0),
      skipped: Array.isArray(parsed.skipped)
        ? parsed.skipped.filter((item): item is OnboardingStepId =>
            ONBOARDING_STEPS.includes(item as OnboardingStepId),
          )
        : [],
      dietary: Array.isArray(parsed.dietary) ? (parsed.dietary as DietaryPreference[]) : parsed.dietary === null ? null : base.dietary,
    };
  } catch {
    return null;
  }
}

export function serializeOnboardingDraft(draft: OnboardingDraft): string {
  return JSON.stringify({
    ...draft,
    stepIndex: clampOnboardingStepIndex(draft.stepIndex),
  });
}
