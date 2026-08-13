import type { SetType, WeightUnit } from "@/generated/prisma/client";

export function SetFields({
  setType,
  defaults,
  target,
  defaultWeightUnit,
}: {
  setType: SetType;
  defaults?: {
    reps: number | null;
    weight: number | null;
    weightUnit: WeightUnit | null;
    durationSeconds: number | null;
    distanceMeters: number | null;
  };
  // The prescribed reps/seconds/meters for this exercise, from an
  // AI-generated suggestion (null for manually-added exercises), shown
  // alongside the input as a "/ N" hint so the user knows what to aim for.
  target?: number | null;
  defaultWeightUnit?: WeightUnit;
}) {
  return (
    <>
      {setType === "REPS" && (
        <div className="space-y-1">
          <label className="text-xs font-medium">Reps</label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              name="reps"
              min={1}
              max={1000}
              required
              defaultValue={defaults?.reps ?? undefined}
              className="border-input bg-background w-24 rounded-md border px-3 py-2 text-2xl font-semibold"
            />
            {target != null && (
              <span className="text-muted-foreground text-2xl font-semibold">
                / {target}
              </span>
            )}
          </div>
        </div>
      )}
      {setType === "DURATION" && (
        <div className="space-y-1">
          <label className="text-xs font-medium">Seconds</label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              name="durationSeconds"
              min={1}
              max={36000}
              required
              defaultValue={defaults?.durationSeconds ?? undefined}
              className="border-input bg-background w-24 rounded-md border px-3 py-2 text-2xl font-semibold"
            />
            {target != null && (
              <span className="text-muted-foreground text-2xl font-semibold">
                / {target}
              </span>
            )}
          </div>
        </div>
      )}
      {setType === "DISTANCE" && (
        <div className="space-y-1">
          <label className="text-xs font-medium">Meters</label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              name="distanceMeters"
              min={0.1}
              step={0.1}
              required
              defaultValue={defaults?.distanceMeters ?? undefined}
              className="border-input bg-background w-24 rounded-md border px-3 py-2 text-2xl font-semibold"
            />
            {target != null && (
              <span className="text-muted-foreground text-2xl font-semibold">
                / {target}
              </span>
            )}
          </div>
        </div>
      )}
      <div className="space-y-1">
        <label className="text-xs font-medium">Weight (optional)</label>
        <div className="flex gap-1">
          <input
            type="number"
            name="weight"
            min={0}
            step={0.5}
            defaultValue={defaults?.weight ?? undefined}
            className="border-input bg-background w-16 rounded-md border px-2 py-1 text-sm"
          />
          <select
            name="weightUnit"
            defaultValue={defaults?.weightUnit ?? defaultWeightUnit ?? "KG"}
            className="border-input bg-background rounded-md border px-1 py-1 text-sm"
          >
            <option value="KG">kg</option>
            <option value="LB">lb</option>
          </select>
        </div>
      </div>
    </>
  );
}
