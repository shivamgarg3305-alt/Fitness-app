import { addDays } from "./time";
import type { BodyGoal, FitnessLevel, WorkoutPreference } from "./profile";
import type { LiftSet } from "./history";

/** Unique sorted local days (YYYY-MM-DD) that contain a finished strength or GPS session. */
export function uniqueActivityDays(days: string[]): string[] {
  return [...new Set(days.filter((day) => /^\d{4}-\d{2}-\d{2}$/.test(day)))].sort();
}

/**
 * Current streak counts backward from today if today has activity, otherwise from yesterday.
 * A gap breaks the streak. Longest scans the full history.
 */
export function workoutStreak(
  activityDays: string[],
  today: string,
): { current: number; longest: number; includesToday: boolean } {
  const days = uniqueActivityDays(activityDays);
  const set = new Set(days);
  const includesToday = set.has(today);
  const yesterday = addDays(today, -1);

  let current = 0;
  let cursor = includesToday ? today : set.has(yesterday) ? yesterday : null;
  while (cursor && set.has(cursor)) {
    current += 1;
    cursor = addDays(cursor, -1);
  }

  let longest = 0;
  let run = 0;
  let previous: string | null = null;
  for (const day of days) {
    if (previous && day === addDays(previous, 1)) run += 1;
    else run = 1;
    longest = Math.max(longest, run);
    previous = day;
  }

  return { current, longest, includesToday };
}

export function isPersonalRecord(input: {
  exerciseName: string;
  weightKg: number | null;
  priorBestKg: number | null;
}): boolean {
  if (input.weightKg == null || !Number.isFinite(input.weightKg) || input.weightKg <= 0) return false;
  if (input.priorBestKg == null) return true;
  return input.weightKg > input.priorBestKg;
}

export function priorBestWeightKg(sets: LiftSet[], exerciseName: string): number | null {
  let best: number | null = null;
  for (const set of sets) {
    if (set.exerciseName !== exerciseName) continue;
    if (set.weightKg == null || !Number.isFinite(set.weightKg) || set.weightKg <= 0) continue;
    if (best == null || set.weightKg > best) best = set.weightKg;
  }
  return best;
}

export type WorkoutShareSet = {
  exerciseName: string;
  setIndex: number;
  reps: number | null;
  weightLabel: string | null;
};

export function buildWorkoutShareSummary(input: {
  title: string;
  brandName: string;
  finishedAtLabel: string;
  sets: WorkoutShareSet[];
  streakCurrent: number | null;
  personalRecords: string[];
}): string {
  const lines = [`${input.brandName}`, input.title, input.finishedAtLabel, ""];
  if (input.sets.length === 0) {
    lines.push("No sets logged.");
  } else {
    for (const set of input.sets) {
      const reps = set.reps == null ? "—" : `${set.reps}`;
      const weight = set.weightLabel ?? "bodyweight";
      lines.push(`${set.exerciseName} · set ${set.setIndex} · ${reps} × ${weight}`);
    }
  }
  if (input.personalRecords.length > 0) {
    lines.push("", `New PRs: ${input.personalRecords.join(", ")}`);
  }
  if (input.streakCurrent != null && input.streakCurrent > 0) {
    lines.push(`Workout streak: ${input.streakCurrent} day${input.streakCurrent === 1 ? "" : "s"}`);
  }
  lines.push("", "Shared from VitaCore");
  return lines.join("\n");
}

export type StarterProgramMatchInput = {
  goal: BodyGoal | null;
  fitnessLevel: FitnessLevel | null;
  workoutPreference: WorkoutPreference | null;
};

export type StarterProgramDefinition = {
  id: string;
  title: string;
  summary: string;
  goals: BodyGoal[];
  levels: FitnessLevel[];
  preferences: WorkoutPreference[];
  days: { title: string; exerciseIds: string[] }[];
};

/** Scores how well a starter program fits the onboarding profile. Higher is better. */
export function scoreStarterProgram(
  program: StarterProgramDefinition,
  profile: StarterProgramMatchInput,
): number {
  let score = 0;
  if (profile.goal && program.goals.includes(profile.goal)) score += 3;
  if (profile.fitnessLevel && program.levels.includes(profile.fitnessLevel)) score += 2;
  if (profile.workoutPreference && program.preferences.includes(profile.workoutPreference)) score += 2;
  if (!profile.goal && !profile.fitnessLevel && !profile.workoutPreference) score += 1;
  return score;
}

export function rankStarterPrograms(
  programs: StarterProgramDefinition[],
  profile: StarterProgramMatchInput,
): StarterProgramDefinition[] {
  return [...programs]
    .map((program) => ({ program, score: scoreStarterProgram(program, profile) }))
    .filter((row) => row.score > 0)
    .sort((left, right) => right.score - left.score || left.program.title.localeCompare(right.program.title))
    .map((row) => row.program);
}
