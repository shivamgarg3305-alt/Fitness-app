import type { StarterProgramDefinition } from "@vitacore/domain";

/** Original starter plans using the in-app exercise catalog ids. */
export const starterPrograms: StarterProgramDefinition[] = [
  {
    id: "beginner-strength",
    title: "Beginner strength base",
    summary: "Three short full-body days with the original text library. No video required.",
    goals: ["maintain", "gain", "performance"],
    levels: ["beginner"],
    preferences: ["strength", "mixed"],
    days: [
      { title: "Day A · Squat focus", exerciseIds: ["squat", "pushup", "row", "plank"] },
      { title: "Day B · Hinge focus", exerciseIds: ["hinge", "shoulder-press", "lunge", "deadbug"] },
      { title: "Day C · Carry + bridge", exerciseIds: ["hip-bridge", "carry", "pushup", "breath-reset"] },
    ],
  },
  {
    id: "fat-loss-mixed",
    title: "Move more · mixed week",
    summary: "Walks plus simple strength so a lose-weight goal stays practical.",
    goals: ["lose"],
    levels: ["beginner", "intermediate"],
    preferences: ["cardio", "mixed"],
    days: [
      { title: "Day 1 · Brisk walk + core", exerciseIds: ["walk", "plank", "deadbug"] },
      { title: "Day 2 · Full body", exerciseIds: ["squat", "pushup", "row", "hip-bridge"] },
      { title: "Day 3 · Walk + reset", exerciseIds: ["walk", "breath-reset", "lunge"] },
    ],
  },
  {
    id: "intermediate-strength",
    title: "Intermediate strength",
    summary: "Heavier pattern practice for people already training.",
    goals: ["gain", "performance", "maintain"],
    levels: ["intermediate", "advanced"],
    preferences: ["strength"],
    days: [
      { title: "Day A", exerciseIds: ["squat", "shoulder-press", "row", "plank"] },
      { title: "Day B", exerciseIds: ["hinge", "pushup", "lunge", "carry"] },
      { title: "Day C", exerciseIds: ["hip-bridge", "shoulder-press", "deadbug", "breath-reset"] },
    ],
  },
  {
    id: "mobility-reset",
    title: "Mobility & reset",
    summary: "Low-stress sessions when recovery or mobility is the preference.",
    goals: ["maintain", "performance"],
    levels: ["beginner", "intermediate", "advanced"],
    preferences: ["mobility", "mixed"],
    days: [
      { title: "Reset A", exerciseIds: ["breath-reset", "hip-bridge", "deadbug"] },
      { title: "Reset B", exerciseIds: ["walk", "plank", "breath-reset"] },
    ],
  },
];
