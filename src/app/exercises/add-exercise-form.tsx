"use client";

import { useActionState } from "react";
import { createExerciseAction, type ExerciseFormState } from "./actions";

export function AddExerciseForm() {
  const [state, formAction, pending] = useActionState<
    ExerciseFormState,
    FormData
  >(createExerciseAction, undefined);

  return (
    <form action={formAction} className="space-y-3 rounded-md border p-4">
      <h2 className="text-sm font-medium">Add an exercise</h2>
      <div className="space-y-1">
        <label htmlFor="name" className="text-sm font-medium">
          Name
        </label>
        <input
          id="name"
          name="name"
          required
          maxLength={100}
          placeholder="Bench Press"
          className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
        />
      </div>
      <div className="space-y-1">
        <label htmlFor="muscleGroup" className="text-sm font-medium">
          Muscle group (optional)
        </label>
        <input
          id="muscleGroup"
          name="muscleGroup"
          maxLength={100}
          placeholder="Chest"
          className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
        />
      </div>
      <div className="space-y-1">
        <label htmlFor="defaultSetType" className="text-sm font-medium">
          Default set type
        </label>
        <select
          id="defaultSetType"
          name="defaultSetType"
          defaultValue="REPS"
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
      <button
        type="submit"
        disabled={pending}
        className="bg-primary text-primary-foreground w-full rounded-md px-3 py-2 text-sm font-medium disabled:opacity-50"
      >
        {pending ? "Adding…" : "Add exercise"}
      </button>
    </form>
  );
}
