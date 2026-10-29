/**
 * VitaCore activity-load (strain-style) scoring.
 *
 * Explainable heuristic from recorded workouts, GPS sessions, and optional steps.
 * Not clinically validated. Does not invent heart-rate zones or wearable strain.
 * Missing inputs are omitted; with nothing usable the score is unavailable.
 */

export type ActivityLoadInput = {
  /** Finished strength/workout sessions today (duration minutes). */
  workoutMinutes: number | null;
  /** Finished GPS/activity moving minutes today. */
  activityMovingMinutes: number | null;
  /** Steps today when available from a health source. */
  steps: number | null;
  /** Optional personal step baseline (e.g. recent average). Null skips the steps factor. */
  stepBaseline: number | null;
  /**
   * Optional heart-rate zone minutes from a trusted source.
   * Never invent zones; pass null when unavailable.
   */
  elevatedHeartMinutes: number | null;
};

export type ActivityLoadFactorId = "workouts" | "gps" | "steps" | "heart_rate";

export type ActivityLoadFactor = {
  id: ActivityLoadFactorId;
  weight: number;
  /** Contribution 0–100 before weight normalization. */
  points: number;
  detail: string;
};

export type ActivityLoadScore =
  | {
      status: "scored";
      /** 0–21 scale for display familiarity without copying a proprietary formula. */
      load: number;
      factors: ActivityLoadFactor[];
      omitted: ActivityLoadFactorId[];
    }
  | { status: "unavailable"; reason: "no_inputs" };

const BASE_WEIGHT: Record<ActivityLoadFactorId, number> = {
  workouts: 0.35,
  gps: 0.3,
  steps: 0.2,
  heart_rate: 0.15,
};

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function clampLoad(value: number): number {
  return Math.round(Math.max(0, Math.min(21, value)) * 10) / 10;
}

/**
 * Maps available activity inputs to a 0–21 load.
 * Each factor caps independently so one large workout cannot invent HR zones or steps.
 */
export function scoreActivityLoad(input: ActivityLoadInput): ActivityLoadScore {
  const raw: Array<Omit<ActivityLoadFactor, "weight"> & { baseWeight: number }> = [];

  if (input.workoutMinutes != null && input.workoutMinutes > 0) {
    // ~90 minutes of strength ≈ full contribution for this factor.
    const points = clamp01(input.workoutMinutes / 90) * 100;
    raw.push({
      id: "workouts",
      baseWeight: BASE_WEIGHT.workouts,
      points: Math.round(points),
      detail: `${Math.round(input.workoutMinutes)} min of logged workouts (duration only; not effort from heart rate).`,
    });
  }

  if (input.activityMovingMinutes != null && input.activityMovingMinutes > 0) {
    const points = clamp01(input.activityMovingMinutes / 75) * 100;
    raw.push({
      id: "gps",
      baseWeight: BASE_WEIGHT.gps,
      points: Math.round(points),
      detail: `${Math.round(input.activityMovingMinutes)} moving minutes from recorded GPS activity.`,
    });
  }

  if (input.steps != null && input.steps > 0) {
    const baseline = input.stepBaseline != null && input.stepBaseline > 0 ? input.stepBaseline : 8_000;
    const points = clamp01(input.steps / baseline) * 100;
    raw.push({
      id: "steps",
      baseWeight: BASE_WEIGHT.steps,
      points: Math.round(points),
      detail:
        input.stepBaseline != null && input.stepBaseline > 0
          ? `Steps ${input.steps.toLocaleString("en-US")} vs your baseline ${Math.round(baseline).toLocaleString("en-US")}.`
          : `Steps ${input.steps.toLocaleString("en-US")} vs a default 8,000 reference (no personal baseline yet).`,
    });
  }

  if (input.elevatedHeartMinutes != null && input.elevatedHeartMinutes > 0) {
    const points = clamp01(input.elevatedHeartMinutes / 45) * 100;
    raw.push({
      id: "heart_rate",
      baseWeight: BASE_WEIGHT.heart_rate,
      points: Math.round(points),
      detail: `${Math.round(input.elevatedHeartMinutes)} min of elevated heart rate from a health source — not estimated zones.`,
    });
  }

  if (raw.length === 0) return { status: "unavailable", reason: "no_inputs" };

  const weightSum = raw.reduce((sum, factor) => sum + factor.baseWeight, 0);
  const normalized = raw.reduce((sum, factor) => sum + factor.points * (factor.baseWeight / weightSum), 0);
  const present = new Set(raw.map((factor) => factor.id));
  const omitted = (Object.keys(BASE_WEIGHT) as ActivityLoadFactorId[]).filter((id) => !present.has(id));

  return {
    status: "scored",
    load: clampLoad((normalized / 100) * 21),
    omitted,
    factors: raw.map((factor) => ({
      id: factor.id,
      weight: factor.baseWeight / weightSum,
      points: factor.points,
      detail: factor.detail,
    })),
  };
}

/** Sum moving seconds for sessions that started on `day` (local YYYY-MM-DD via caller). */
export function sumMovingMinutes(sessions: Array<{ movingSeconds: number }>): number {
  const total = sessions.reduce((sum, session) => sum + Math.max(0, session.movingSeconds), 0);
  return Math.round(total / 60);
}

export function sumWorkoutMinutes(sessions: Array<{ startedAt: string; endedAt: string | null }>): number | null {
  let total = 0;
  let any = false;
  for (const session of sessions) {
    if (!session.endedAt) continue;
    const start = Date.parse(session.startedAt);
    const end = Date.parse(session.endedAt);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) continue;
    any = true;
    total += (end - start) / 60_000;
  }
  return any ? Math.round(total) : null;
}
