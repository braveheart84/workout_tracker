// PRD 7.2's focus-area generation shortcut (PR-21): strength / cardio / HIIT
// / mobility, steering what kind of session(s) the LLM proposes without
// dictating exact exercises. Shared between the multi-day generate form
// (checkbox labels) and generate/actions.ts (formData validation).
export const FOCUS_AREAS = ["STRENGTH", "CARDIO", "HIIT", "MOBILITY"] as const;
export type FocusArea = (typeof FOCUS_AREAS)[number];

export const FOCUS_AREA_LABELS: Record<FocusArea, string> = {
  STRENGTH: "Strength",
  CARDIO: "Cardio",
  HIIT: "HIIT",
  MOBILITY: "Mobility",
};
