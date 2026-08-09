"use client";

import { useActionState, useState } from "react";
import type { Exercise } from "@/generated/prisma/client";
import {
  deleteExerciseAction,
  updateExerciseAction,
  type ExerciseFormState,
} from "./actions";

const SET_TYPE_LABELS: Record<Exercise["defaultSetType"], string> = {
  REPS: "Reps",
  DURATION: "Duration",
  DISTANCE: "Distance",
};

export function ExerciseRow({ exercise }: { exercise: Exercise }) {
  const [editing, setEditing] = useState(false);
  const boundUpdate = updateExerciseAction.bind(null, exercise.id);
  const [state, formAction, pending] = useActionState<
    ExerciseFormState,
    FormData
  >(boundUpdate, undefined);

  const boundDelete = deleteExerciseAction.bind(null, exercise.id);
  const [deleteState, deleteFormAction, deletePending] = useActionState<
    ExerciseFormState,
    FormData
  >(boundDelete, undefined);

  // Close the edit form once a save succeeds. Adjusting state during
  // render (rather than in an effect) per React's guidance for "resetting
  // state when a value changes" - https://react.dev/learn/you-might-not-need-an-effect
  const [prevState, setPrevState] = useState(state);
  if (state !== prevState) {
    setPrevState(state);
    if (state?.success) {
      setEditing(false);
    }
  }

  if (!editing) {
    return (
      <li className="space-y-1 p-3">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium">{exercise.name}</p>
            <p className="text-muted-foreground text-xs">
              {exercise.muscleGroup ? `${exercise.muscleGroup} · ` : ""}
              {SET_TYPE_LABELS[exercise.defaultSetType]}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="text-xs underline"
            >
              Edit
            </button>
            <form
              action={deleteFormAction}
              onSubmit={(e) => {
                if (!confirm(`Delete "${exercise.name}"?`)) {
                  e.preventDefault();
                }
              }}
            >
              <button
                type="submit"
                disabled={deletePending}
                className="text-destructive text-xs underline disabled:opacity-50"
              >
                {deletePending ? "Deleting…" : "Delete"}
              </button>
            </form>
          </div>
        </div>
        {deleteState?.error && (
          <p className="text-destructive text-xs">{deleteState.error}</p>
        )}
      </li>
    );
  }

  return (
    <li className="space-y-3 p-3">
      <form action={formAction} className="space-y-3">
        <div className="space-y-1">
          <label className="text-sm font-medium">Name</label>
          <input
            name="name"
            defaultValue={exercise.name}
            required
            maxLength={100}
            className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
          />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium">Muscle group</label>
          <input
            name="muscleGroup"
            defaultValue={exercise.muscleGroup ?? ""}
            maxLength={100}
            className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
          />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium">Default set type</label>
          <select
            name="defaultSetType"
            defaultValue={exercise.defaultSetType}
            className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
          >
            <option value="REPS">Reps (+ weight)</option>
            <option value="DURATION">Duration</option>
            <option value="DISTANCE">Distance</option>
          </select>
        </div>
        {state?.error && (
          <p className="text-destructive text-sm">{state.error}</p>
        )}
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={pending}
            className="bg-primary text-primary-foreground rounded-md px-3 py-2 text-sm font-medium disabled:opacity-50"
          >
            {pending ? "Saving…" : "Save"}
          </button>
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="border-input rounded-md border px-3 py-2 text-sm font-medium"
          >
            Cancel
          </button>
        </div>
      </form>
    </li>
  );
}
