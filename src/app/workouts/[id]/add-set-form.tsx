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
  defaultWeightUnit,
}: {
  sessionId: string;
  workoutExerciseId: string;
  roundNumber: number;
  setType: SetType;
  defaultWeightUnit: WeightUnit;
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
  const [prevState, setPrevState] = useState(state);
  if (state !== prevState) {
    setPrevState(state);
    if (state?.success) {
      setFormKey((k) => k + 1);
    }
  }

  return (
    <div className="space-y-1">
      <form
        key={formKey}
        action={formAction}
        className="flex flex-wrap items-end gap-2"
      >
        <SetFields setType={setType} defaultWeightUnit={defaultWeightUnit} />
        <button
          type="submit"
          disabled={pending}
          className="bg-primary text-primary-foreground rounded-md px-2 py-1 text-xs font-medium disabled:opacity-50"
        >
          {pending ? "Logging…" : "Log set"}
        </button>
      </form>
      {state?.error && (
        <p className="text-destructive text-xs">{state.error}</p>
      )}
    </div>
  );
}
