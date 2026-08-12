// Standing generation preferences (Account settings): captured once so the
// user doesn't have to restate session length, cardio finisher, equipment,
// or injuries/dislikes in free text on every single generation request.
// Shared between the settings form (labels) and generate/actions.ts
// (validation) so both stay in sync with the same fixed set of values.
export const CARDIO_FINISHER_OPTIONS = [
  "ALWAYS",
  "NEVER",
  "SOMETIMES",
] as const;
export type CardioFinisherPreference = (typeof CARDIO_FINISHER_OPTIONS)[number];

export const CARDIO_FINISHER_LABELS: Record<CardioFinisherPreference, string> =
  {
    ALWAYS: "Always include a cardio finisher",
    NEVER: "Never include a cardio finisher",
    SOMETIMES: "No preference - let it decide",
  };

export const EQUIPMENT_OPTIONS = [
  "BARBELL",
  "DUMBBELLS",
  "KETTLEBELLS",
  "MACHINES",
  "CABLES",
  "RESISTANCE_BANDS",
  "PULL_UP_BAR",
  "CARDIO_MACHINES",
  "BATTLE_ROPES",
  "SLED",
] as const;
export type Equipment = (typeof EQUIPMENT_OPTIONS)[number];

export const EQUIPMENT_LABELS: Record<Equipment, string> = {
  BARBELL: "Barbell",
  DUMBBELLS: "Dumbbells",
  KETTLEBELLS: "Kettlebells",
  MACHINES: "Strength/weight machines",
  CABLES: "Cables",
  RESISTANCE_BANDS: "Resistance bands",
  PULL_UP_BAR: "Pull-up bar",
  CARDIO_MACHINES: "Cardio machines (treadmill, rower, skierg, bike, etc.)",
  BATTLE_ROPES: "Battle ropes",
  SLED: "Sled",
};
