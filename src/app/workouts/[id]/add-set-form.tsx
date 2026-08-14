"use client";

import { useActionState, useState } from "react";
import type { SetType, WeightUnit } from "@/generated/prisma/client";
import { addSetAction, type SetFormState } from "./set-actions";
import { SetFields } from "./set-fields";

export function AddSetForm({
  sessionId,
  workoutExerciseId,
  roundNumber,
  setType,
  target,
  defaultWeightUnit,
  hasLoggedSets = false,
  defaults,
}: {
  sessionId: string;
  workoutExerciseId: string;
  roundNumber: number;
  setType: SetType;
  target: number | null;
  defaultWeightUnit: WeightUnit;
  // Whether this round already has a logged set for this exercise, as of
  // the last server render. Used only to pick the form's starting
  // collapsed/expanded state - once a set is logged the form always
  // collapses back down to the "+ Log another set" link, regardless of
  // this value, so stray reps/weight boxes don't linger on screen.
  hasLoggedSets?: boolean;
  // Round 1's logged values for this exercise, if any - pre-fills rounds
  // 2+ so the user isn't retyping the same reps/weight every round.
  defaults?: {
    reps: number | null;
    weight: number | null;
    weightUnit: WeightUnit | null;
    durationSeconds: number | null;
    distanceMeters: number | null;
  };
}) {
  const boundAdd = addSetAction.bind(
    null,
    sessionId,
    workoutExerciseId,
    roundNumber,
  );
  const [state, formAction, pending] = useActionState<SetFormState, FormData>(
    boundAdd,
    undefined,
  );

  const [formKey, setFormKey] = useState(0);
  const [expanded, setExpanded] = useState(!hasLoggedSets);
  const [prevState, setPrevState] = useState(state);
  if (state !== prevState) {
    setPrevState(state);
    if (state?.success) {
      setFormKey((k) => k + 1);
      setExpanded(false);
    }
  }

  if (!expanded) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        className="text-muted-foreground text-xs underline"
      >
        + Log another set
      </button>
    );
  }

  return (
    <div className="space-y-1">
      <form key={formKey} action={formAction} className="overflow-x-auto">
        <SetFields
          setType={setType}
          target={target}
          defaultWeightUnit={defaultWeightUnit}
          defaults={defaults}
          actions={
            <>
              <button
                type="submit"
                disabled={pending}
                className="bg-primary text-primary-foreground shrink-0 rounded-md px-2 py-1.5 text-xs font-medium disabled:opacity-50"
              >
                {pending ? "Logging…" : "Log set"}
              </button>
              {hasLoggedSets && (
                <button
                  type="button"
                  onClick={() => setExpanded(false)}
                  className="shrink-0 text-xs underline"
                >
                  Cancel
                </button>
              )}
            </>
          }
        />
      </form>
      {state?.error && (
        <p className="text-destructive text-xs">{state.error}</p>
      )}
    </div>
  );
}
