import { describe, expect, it } from "vitest";
import { scoreActivityLoad, sumMovingMinutes, sumWorkoutMinutes } from "./activityLoad";

describe("scoreActivityLoad", () => {
  it("is unavailable with no inputs", () => {
    expect(
      scoreActivityLoad({
        workoutMinutes: null,
        activityMovingMinutes: null,
        steps: null,
        stepBaseline: null,
        elevatedHeartMinutes: null,
      }),
    ).toEqual({ status: "unavailable", reason: "no_inputs" });
  });

  it("scores from workouts and steps without inventing heart-rate zones", () => {
    const result = scoreActivityLoad({
      workoutMinutes: 45,
      activityMovingMinutes: null,
      steps: 4000,
      stepBaseline: 8000,
      elevatedHeartMinutes: null,
    });
    expect(result.status).toBe("scored");
    if (result.status !== "scored") return;
    expect(result.load).toBeGreaterThan(0);
    expect(result.load).toBeLessThanOrEqual(21);
    expect(result.omitted).toContain("heart_rate");
    expect(result.omitted).toContain("gps");
    expect(result.factors.map((f) => f.id).sort()).toEqual(["steps", "workouts"]);
  });

  it("includes GPS moving minutes when present", () => {
    const result = scoreActivityLoad({
      workoutMinutes: null,
      activityMovingMinutes: 40,
      steps: null,
      stepBaseline: null,
      elevatedHeartMinutes: null,
    });
    expect(result.status).toBe("scored");
    if (result.status !== "scored") return;
    expect(result.factors).toHaveLength(1);
    expect(result.factors[0]?.id).toBe("gps");
  });

  it("never treats zero or missing elevated HR as a scored factor", () => {
    const result = scoreActivityLoad({
      workoutMinutes: 20,
      activityMovingMinutes: null,
      steps: null,
      stepBaseline: null,
      elevatedHeartMinutes: 0,
    });
    if (result.status !== "scored") throw new Error("expected scored");
    expect(result.factors.every((f) => f.id !== "heart_rate")).toBe(true);
  });
});

describe("activity duration helpers", () => {
  it("sums moving minutes", () => {
    expect(sumMovingMinutes([{ movingSeconds: 600 }, { movingSeconds: 300 }])).toBe(15);
  });

  it("sums finished workout minutes and ignores open sessions", () => {
    expect(
      sumWorkoutMinutes([
        { startedAt: "2026-10-28T10:00:00.000Z", endedAt: "2026-10-28T10:40:00.000Z" },
        { startedAt: "2026-10-28T12:00:00.000Z", endedAt: null },
      ]),
    ).toBe(40);
  });
});
