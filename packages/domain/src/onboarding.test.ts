import { describe, expect, it } from "vitest";
import {
  canContinueOnboardingStep,
  createEmptyOnboardingDraft,
  isOnboardingStepOptional,
  markStepSkipped,
  onboardingStepAt,
  parseOnboardingDraft,
  serializeOnboardingDraft,
  stepAnswerState,
} from "./onboarding";

describe("onboarding draft", () => {
  it("starts at welcome and allows continue", () => {
    const draft = createEmptyOnboardingDraft();
    expect(onboardingStepAt(draft.stepIndex)).toBe("welcome");
    expect(canContinueOnboardingStep(draft, "welcome")).toBe(true);
  });

  it("blocks continue on required empty steps", () => {
    const draft = createEmptyOnboardingDraft();
    expect(canContinueOnboardingStep(draft, "goal")).toBe(false);
    expect(canContinueOnboardingStep(draft, "activity")).toBe(false);
    expect(canContinueOnboardingStep({ ...draft, goal: "maintain" }, "goal")).toBe(true);
  });

  it("allows skip on optional steps without inventing answers", () => {
    const draft = createEmptyOnboardingDraft();
    expect(isOnboardingStepOptional("age")).toBe(true);
    expect(isOnboardingStepOptional("goal")).toBe(false);
    const skipped = markStepSkipped({ ...draft, ageYears: 30 }, "age");
    expect(skipped.ageYears).toBeNull();
    expect(stepAnswerState(skipped, "age")).toBe("skipped");
    expect(canContinueOnboardingStep(skipped, "age")).toBe(true);
  });

  it("does not invent dietary preference on nutrition skip", () => {
    const skipped = markStepSkipped(createEmptyOnboardingDraft(), "nutrition");
    expect(skipped.dietary).toBeNull();
    expect(stepAnswerState(skipped, "nutrition")).toBe("skipped");
  });

  it("round-trips draft JSON and clamps step index", () => {
    const draft = {
      ...createEmptyOnboardingDraft("imperial"),
      stepIndex: 99,
      goal: "lose" as const,
      skipped: ["age" as const],
    };
    const raw = serializeOnboardingDraft(draft);
    const parsed = parseOnboardingDraft(raw);
    expect(parsed?.stepIndex).toBe(9);
    expect(parsed?.goal).toBe("lose");
    expect(parsed?.unitSystem).toBe("imperial");
    expect(parsed?.skipped).toEqual(["age"]);
  });

  it("returns null for corrupt draft JSON", () => {
    expect(parseOnboardingDraft("{")).toBeNull();
    expect(parseOnboardingDraft(null)).toBeNull();
  });
});
