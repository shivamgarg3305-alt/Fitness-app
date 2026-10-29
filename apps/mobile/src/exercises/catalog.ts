export type ExerciseDifficulty = "beginner" | "intermediate" | "advanced";

export type ExerciseMedia = {
  /** Honest status — no fabricated demonstration is claimed as real footage. */
  status: "unavailable";
  placeholderLabel: string;
  note: string;
};

export type Exercise = {
  id: string;
  name: string;
  muscleGroups: string[];
  primaryMuscle: string;
  secondaryMuscles: string[];
  equipment: string;
  difficulty: ExerciseDifficulty;
  movementType: string;
  /** Short setup before the first rep. */
  setup: string[];
  /** Numbered execution steps. */
  instructions: string[];
  /** Form cues shown during the set. */
  formCues: string[];
  /** Breathing guidance when relevant. */
  breathing: string | null;
  /** Tempo cue such as "3-1-1" (eccentric-pause-concentric). Null when not applicable. */
  tempo: string | null;
  safety: string;
  media: ExerciseMedia;
};

const NO_MEDIA: ExerciseMedia = {
  status: "unavailable",
  placeholderLabel: "Demo media not bundled",
  note: "Original text cues only. No licensed video or fabricated animation is shown as a demonstration.",
};

/** Original descriptions. Not copied from a licensed video library. */
export const exercises: Exercise[] = [
  {
    id: "squat",
    name: "Squat",
    muscleGroups: ["legs"],
    primaryMuscle: "quadriceps",
    secondaryMuscles: ["glutes", "core"],
    equipment: "bodyweight",
    difficulty: "beginner",
    movementType: "squat",
    setup: ["Feet about shoulder-width.", "Toes slightly out if that feels natural.", "Brace lightly before you move."],
    instructions: ["Stand tall.", "Sit your hips back and bend your knees.", "Keep the chest up and stand again."],
    formCues: ["Knees track over mid-foot", "Heels stay down", "Ribs stacked over pelvis"],
    breathing: "Inhale as you lower. Exhale as you stand.",
    tempo: "3-0-1",
    safety: "Stop if your knees move into a sharp pain. Keep the heels down.",
    media: NO_MEDIA,
  },
  {
    id: "hinge",
    name: "Hip hinge",
    muscleGroups: ["posterior"],
    primaryMuscle: "hamstrings",
    secondaryMuscles: ["glutes", "back"],
    equipment: "bodyweight",
    difficulty: "beginner",
    movementType: "hinge",
    setup: ["Soft knees.", "Hands on hips or holding light weights.", "Find a long spine before you move."],
    instructions: ["Push your hips back until the torso leans forward.", "Feel the stretch in the back of the thighs.", "Stand by driving the hips forward."],
    formCues: ["Hips go back, not down", "Shin angle stays quiet", "Neck stays long"],
    breathing: "Inhale on the hinge. Exhale as you stand.",
    tempo: "3-1-1",
    safety: "Keep a long spine. Do not round hard to chase range.",
    media: NO_MEDIA,
  },
  {
    id: "pushup",
    name: "Push-up",
    muscleGroups: ["push"],
    primaryMuscle: "chest",
    secondaryMuscles: ["triceps", "shoulders"],
    equipment: "bodyweight",
    difficulty: "beginner",
    movementType: "push",
    setup: ["Hands under shoulders.", "Body in one line from head to heels.", "Use an incline if the floor version sags."],
    instructions: ["Lower your chest between your hands.", "Pause briefly without collapsing.", "Press the floor away to return."],
    formCues: ["Elbows about 45°", "Glutes lightly on", "Head neutral"],
    breathing: "Inhale on the way down. Exhale as you press.",
    tempo: "3-1-1",
    safety: "Use an incline if the full range pulls your lower back into a sag.",
    media: NO_MEDIA,
  },
  {
    id: "row",
    name: "Bent-over row",
    muscleGroups: ["pull"],
    primaryMuscle: "upper back",
    secondaryMuscles: ["biceps", "rear shoulders"],
    equipment: "dumbbell",
    difficulty: "intermediate",
    movementType: "pull",
    setup: ["Hinge until the torso is stable.", "Weights hang under the shoulders.", "Brace before the first pull."],
    instructions: ["Pull the weights toward your ribs.", "Squeeze the shoulder blades gently.", "Lower without jerking."],
    formCues: ["Elbows close to the body", "No bounce at the bottom", "Neck stays long"],
    breathing: "Exhale on the pull. Inhale as you lower.",
    tempo: "2-1-2",
    safety: "Brace before the pull. Do not yank with the lower back.",
    media: NO_MEDIA,
  },
  {
    id: "lunge",
    name: "Split squat",
    muscleGroups: ["legs"],
    primaryMuscle: "quadriceps",
    secondaryMuscles: ["glutes"],
    equipment: "bodyweight",
    difficulty: "beginner",
    movementType: "lunge",
    setup: ["Step one foot back to a stable stance.", "Front heel planted.", "Torso tall."],
    instructions: ["Lower the back knee toward the floor.", "Keep most of the load on the front foot.", "Press through the front foot to stand."],
    formCues: ["Front knee tracks forward", "Hips square", "Shorten the stance if balance fails"],
    breathing: "Inhale as you lower. Exhale as you stand.",
    tempo: "3-0-1",
    safety: "Use a shorter stance if balance is the limiter.",
    media: NO_MEDIA,
  },
  {
    id: "plank",
    name: "Plank",
    muscleGroups: ["core"],
    primaryMuscle: "core",
    secondaryMuscles: ["shoulders"],
    equipment: "bodyweight",
    difficulty: "beginner",
    movementType: "brace",
    setup: ["Forearms or hands on the floor.", "Feet hip-width.", "Squeeze glutes lightly."],
    instructions: ["Make a straight line from head to heels.", "Hold without sagging or piking.", "Leave the hold while form is still clean."],
    formCues: ["Ribs down", "Eyes on the floor", "Quiet breathing"],
    breathing: "Steady nasal breaths. Do not hold your breath.",
    tempo: null,
    safety: "End the hold if the lower back starts to pinch.",
    media: NO_MEDIA,
  },
  {
    id: "deadbug",
    name: "Dead bug",
    muscleGroups: ["core"],
    primaryMuscle: "core",
    secondaryMuscles: ["hips"],
    equipment: "bodyweight",
    difficulty: "beginner",
    movementType: "control",
    setup: ["Lie on your back.", "Arms up, knees bent above the hips.", "Press the lower back gently into the floor."],
    instructions: ["Reach one arm and the opposite leg away.", "Return with control.", "Switch sides."],
    formCues: ["Slow limbs", "Back stays quiet", "Exhale on the reach"],
    breathing: "Exhale as the limbs reach away. Inhale as they return.",
    tempo: "2-1-2",
    safety: "Keep the lower back quiet on the floor.",
    media: NO_MEDIA,
  },
  {
    id: "carry",
    name: "Suitcase carry",
    muscleGroups: ["core"],
    primaryMuscle: "core",
    secondaryMuscles: ["grip", "shoulders"],
    equipment: "dumbbell",
    difficulty: "beginner",
    movementType: "carry",
    setup: ["Hold one weight at your side.", "Stand tall before you walk.", "Soft knees."],
    instructions: ["Walk without leaning into the weight.", "Keep steps quiet and even.", "Switch hands and walk back."],
    formCues: ["Ribs stacked", "Shoulders level", "No rush"],
    breathing: "Breathe normally while you walk.",
    tempo: null,
    safety: "Choose a weight you can keep level.",
    media: NO_MEDIA,
  },
  {
    id: "hip-bridge",
    name: "Hip bridge",
    muscleGroups: ["posterior"],
    primaryMuscle: "glutes",
    secondaryMuscles: ["hamstrings"],
    equipment: "bodyweight",
    difficulty: "beginner",
    movementType: "bridge",
    setup: ["Lie down with feet flat.", "Arms by your sides.", "Chin gently tucked."],
    instructions: ["Press the hips up until the body is a line.", "Pause without flaring the ribs.", "Lower with control."],
    formCues: ["Drive through heels", "Glutes finish the rep", "Ribs stay quiet"],
    breathing: "Exhale as you bridge. Inhale as you lower.",
    tempo: "2-1-2",
    safety: "Do not shove the ribs up at the top.",
    media: NO_MEDIA,
  },
  {
    id: "shoulder-press",
    name: "Shoulder press",
    muscleGroups: ["push"],
    primaryMuscle: "shoulders",
    secondaryMuscles: ["triceps"],
    equipment: "dumbbell",
    difficulty: "intermediate",
    movementType: "press",
    setup: ["Weights at shoulder height.", "Feet planted.", "Brace before the press."],
    instructions: ["Press the weights overhead.", "Lock out without shrugging hard.", "Lower to the shoulders."],
    formCues: ["Wrists stacked", "Ribs down", "Soft knees"],
    breathing: "Exhale on the press. Inhale as you lower.",
    tempo: "2-0-2",
    safety: "Stop if the shoulder pinches at the top. A neutral grip is fine.",
    media: NO_MEDIA,
  },
  {
    id: "walk",
    name: "Brisk walk",
    muscleGroups: ["cardio"],
    primaryMuscle: "legs",
    secondaryMuscles: ["cardio"],
    equipment: "none",
    difficulty: "beginner",
    movementType: "cardio",
    setup: ["Comfortable shoes.", "Upright posture.", "Start easy for the first minute."],
    instructions: ["Walk at a pace you can speak in short sentences.", "Keep the steps quiet.", "Finish while you still feel steady."],
    formCues: ["Relaxed shoulders", "Even stride", "No forced breathing"],
    breathing: "Easy nasal or mixed breathing. Do not force a pattern.",
    tempo: null,
    safety: "Use the activity recorder if you want a route.",
    media: NO_MEDIA,
  },
  {
    id: "breath-reset",
    name: "Easy breathing reset",
    muscleGroups: ["mobility"],
    primaryMuscle: "breathing",
    secondaryMuscles: ["core"],
    equipment: "none",
    difficulty: "beginner",
    movementType: "mobility",
    setup: ["Sit or lie down.", "Unclench the jaw.", "Hands on ribs or belly if that helps."],
    instructions: ["Inhale through the nose for about four seconds.", "Exhale longer than you inhaled.", "Repeat for several quiet cycles."],
    formCues: ["Soft belly", "No shoulder shrug", "Slow exit"],
    breathing: "Inhale 4 · exhale 6 as a starting point.",
    tempo: null,
    safety: "Stop if you feel lightheaded and breathe normally.",
    media: NO_MEDIA,
  },
];

export function getExercise(id: string | null | undefined): Exercise | undefined {
  if (!id) return undefined;
  return exercises.find((item) => item.id === id);
}

export function muscleFilterOptions(): string[] {
  return [...new Set(exercises.flatMap((item) => [item.primaryMuscle, ...item.muscleGroups]))].sort();
}
