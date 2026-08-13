import type { ReactNode } from "react";
import type { SetType, WeightUnit } from "@/generated/prisma/client";

export function SetFields({
  setType,
  defaults,
  target,
  defaultWeightUnit,
  actions,
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
  // The form's submit/cancel button(s), rendered as part of this same row
  // rather than as separate siblings after this component.
  actions?: ReactNode;
}) {
  // Everything (the primary field, its target, weight, and the caller's
  // action buttons) sits in one row that never wraps - even inside the
  // "up next" round's extra ring padding, which is the tightest fit. Field
  // name labels are dropped in favor of aria-label, since context (right
  // under the exercise name, next to a "/ N" target, next to a kg/lb
  // picker) already makes each field's purpose clear at a glance.
  return (
    <div className="flex flex-nowrap items-center gap-1">
      {setType === "REPS" && (
        <>
          <input
            type="number"
            name="reps"
            min={1}
            max={1000}
            required
            aria-label="Reps"
            defaultValue={defaults?.reps ?? undefined}
            className="border-input bg-background w-12 min-w-0 rounded-md border px-1.5 py-1.5 text-base font-semibold"
          />
          {target != null && (
            <span className="text-muted-foreground shrink-0 text-base font-semibold">
              /{target}
            </span>
          )}
        </>
      )}
      {setType === "DURATION" && (
        <>
          <input
            type="number"
            name="durationSeconds"
            min={1}
            max={36000}
            required
            aria-label="Seconds"
            defaultValue={defaults?.durationSeconds ?? undefined}
            className="border-input bg-background w-14 min-w-0 rounded-md border px-1.5 py-1.5 text-base font-semibold"
          />
          {target != null && (
            <span className="text-muted-foreground shrink-0 text-base font-semibold">
              /{target}
            </span>
          )}
        </>
      )}
      {setType === "DISTANCE" && (
        <>
          <input
            type="number"
            name="distanceMeters"
            min={0.1}
            step={0.1}
            required
            aria-label="Meters"
            defaultValue={defaults?.distanceMeters ?? undefined}
            className="border-input bg-background w-14 min-w-0 rounded-md border px-1.5 py-1.5 text-base font-semibold"
          />
          {target != null && (
            <span className="text-muted-foreground shrink-0 text-base font-semibold">
              /{target}
            </span>
          )}
        </>
      )}
      <input
        type="number"
        name="weight"
        min={0}
        step={0.5}
        aria-label="Weight (optional)"
        defaultValue={defaults?.weight ?? undefined}
        className="border-input bg-background w-10 min-w-0 rounded-md border px-1 py-1.5 text-sm"
      />
      <select
        name="weightUnit"
        aria-label="Weight unit"
        defaultValue={defaults?.weightUnit ?? defaultWeightUnit ?? "KG"}
        className="border-input bg-background shrink-0 rounded-md border px-1 py-1.5 text-sm"
      >
        <option value="KG">kg</option>
        <option value="LB">lb</option>
      </select>
      {actions}
    </div>
  );
}
