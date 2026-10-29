import { describe, expect, it } from "vitest";
import {
  buildWorkoutShareSummary,
  isPersonalRecord,
  priorBestWeightKg,
  rankStarterPrograms,
  scoreStarterProgram,
  uniqueActivityDays,
  workoutStreak,
  type StarterProgramDefinition,
} from "./retention";

describe("workoutStreak", () => {
  it("returns zero when there is no recent activity", () => {
    expect(workoutStreak(["2026-10-01"], "2026-10-28")).toEqual({
      current: 0,
      longest: 1,
      includesToday: false,
    });
  });

  it("counts consecutive days ending today", () => {
    expect(workoutStreak(["2026-10-26", "2026-10-27", "2026-10-28"], "2026-10-28")).toEqual({
      current: 3,
      longest: 3,
      includesToday: true,
    });
  });

  it("keeps yesterday streak when today is empty", () => {
    expect(workoutStreak(["2026-10-26", "2026-10-27"], "2026-10-28")).toEqual({
      current: 2,
      longest: 2,
      includesToday: false,
    });
  });

  it("dedupes days and tracks longest across gaps", () => {
    const days = uniqueActivityDays(["2026-10-01", "2026-10-01", "2026-10-02", "2026-10-10", "2026-10-11", "2026-10-12"]);
    expect(workoutStreak(days, "2026-10-12").longest).toBe(3);
    expect(workoutStreak(days, "2026-10-12").current).toBe(3);
  });
});

describe("personal records", () => {
  it("treats the first weighted set as a PR", () => {
    expect(isPersonalRecord({ exerciseName: "Squat", weightKg: 60, priorBestKg: null })).toBe(true);
  });

  it("requires a heavier weight than the prior best", () => {
    expect(isPersonalRecord({ exerciseName: "Squat", weightKg: 60, priorBestKg: 60 })).toBe(false);
    expect(isPersonalRecord({ exerciseName: "Squat", weightKg: 62.5, priorBestKg: 60 })).toBe(true);
    expect(isPersonalRecord({ exerciseName: "Squat", weightKg: null, priorBestKg: 60 })).toBe(false);
  });

  it("reads prior best by exercise name", () => {
    expect(
      priorBestWeightKg(
        [
          { exerciseName: "Squat", weightKg: 50, reps: 5 },
          { exerciseName: "Squat", weightKg: 60, reps: 3 },
          { exerciseName: "Press", weightKg: 40, reps: 8 },
        ],
        "Squat",
      ),
    ).toBe(60);
  });
});

describe("share summary and programs", () => {
  it("builds a shareable text card without inventing metrics", () => {
    const text = buildWorkoutShareSummary({
      title: "Strength session",
      brandName: "VitaCore",
      finishedAtLabel: "28 Oct 2026",
      sets: [{ exerciseName: "Squat", setIndex: 1, reps: 5, weightLabel: "60 kg" }],
      streakCurrent: 4,
      personalRecords: ["Squat"],
    });
    expect(text).toContain("VitaCore");
    expect(text).toContain("Squat · set 1 · 5 × 60 kg");
    expect(text).toContain("New PRs: Squat");
    expect(text).toContain("Workout streak: 4 days");
  });

  it("ranks starter programs by onboarding fit", () => {
    const programs: StarterProgramDefinition[] = [
      {
        id: "cardio",
        title: "Easy cardio",
        summary: "",
        goals: ["lose"],
        levels: ["beginner"],
        preferences: ["cardio"],
        days: [],
      },
      {
        id: "strength",
        title: "Strength base",
        summary: "",
        goals: ["gain", "performance"],
        levels: ["beginner", "intermediate"],
        preferences: ["strength", "mixed"],
        days: [],
      },
    ];
    const ranked = rankStarterPrograms(programs, {
      goal: "gain",
      fitnessLevel: "beginner",
      workoutPreference: "strength",
    });
    expect(ranked[0]?.id).toBe("strength");
    expect(scoreStarterProgram(programs[0]!, { goal: "gain", fitnessLevel: "beginner", workoutPreference: "strength" })).toBeLessThan(
      scoreStarterProgram(programs[1]!, { goal: "gain", fitnessLevel: "beginner", workoutPreference: "strength" }),
    );
  });
});
