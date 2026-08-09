"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import type { Exercise } from "@/generated/prisma/client";
import { ExercisePicker } from "@/components/exercise-picker";
import {
  addExerciseToBlockAction,
  type AddExerciseState,
} from "./block-actions";

export function AddExerciseToBlockForm({
  sessionId,
  blockId,
  exercises,
}: {
  sessionId: string;
  blockId: string;
  exercises: Exercise[];
}) {
  const boundAdd = addExerciseToBlockAction.bind(null, sessionId, blockId);
  const [state, formAction, pending] = useActionState<
    AddExerciseState,
    FormData
  >(boundAdd, undefined);

  // Clear the picker's selection after a successful add by remounting it -
  // adjusting during render rather than in an effect, same pattern as the
  // exercise library's edit-close behavior.
  const [resetKey, setResetKey] = useState(0);
  const [prevState, setPrevState] = useState(state);
  if (state !== prevState) {
    setPrevState(state);
    if (state?.success) {
      setResetKey((k) => k + 1);
    }
  }

  if (exercises.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        No exercises in your library yet.{" "}
        <Link href="/exercises" className="underline">
          Add one
        </Link>{" "}
        to start building this block.
      </p>
    );
  }

  return (
    <form action={formAction} className="space-y-2">
      <div className="flex items-start gap-2">
        <div className="flex-1">
          <ExercisePicker
            key={resetKey}
            exercises={exercises}
            name="exerciseId"
          />
        </div>
        <button
          type="submit"
          disabled={pending}
          className="border-input shrink-0 rounded-md border px-3 py-2 text-sm font-medium disabled:opacity-50"
        >
          {pending ? "Adding…" : "Add exercise"}
        </button>
      </div>
      {state?.error && (
        <p className="text-destructive text-xs">{state.error}</p>
      )}
    </form>
  );
}
