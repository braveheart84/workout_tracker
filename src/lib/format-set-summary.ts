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
