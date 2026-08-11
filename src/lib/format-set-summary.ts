export type SetSummaryInput = {
  setType: "REPS" | "DURATION" | "DISTANCE";
  reps: number | null;
  durationSeconds: number | null;
  distanceMeters: number | null;
  weight: number | null;
  weightUnit: "KG" | "LB" | null;
};

export function formatSetSummary(set: SetSummaryInput) {
  const weightPart =
    set.weight != null
      ? ` × ${set.weight}${set.weightUnit?.toLowerCase()}`
      : "";
  if (set.setType === "REPS") return `${set.reps} reps${weightPart}`;
  if (set.setType === "DURATION") return `${set.durationSeconds}s${weightPart}`;
  return `${set.distanceMeters}m${weightPart}`;
}

// Same units-per-setType formatting as formatSetSummary, but for a bare
// prescribed value (no weight) - used to show a round's target when there's
// no logging form to display it inline with, e.g. reviewing a planned
// workout before starting it.
export function formatTarget(
  setType: SetSummaryInput["setType"],
  target: number | null,
) {
  if (target == null) return null;
  if (setType === "REPS") return `${target} reps`;
  if (setType === "DURATION") return `${target}s`;
  return `${target}m`;
}
