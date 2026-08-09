"use client";

import { useActionState } from "react";
import type { WorkoutSession } from "@/generated/prisma/client";
import {
  updateWorkoutSessionAction,
  type WorkoutSessionFormState,
} from "../actions";

export function SessionForm({
  workoutSession,
  disabled,
}: {
  workoutSession: WorkoutSession;
  disabled: boolean;
}) {
  const boundUpdate = updateWorkoutSessionAction.bind(null, workoutSession.id);
  const [state, formAction, pending] = useActionState<
    WorkoutSessionFormState,
    FormData
  >(boundUpdate, undefined);

  return (
    <form action={formAction} className="space-y-4 rounded-md border p-4">
      <div className="space-y-1">
        <label htmlFor="label" className="text-sm font-medium">
          Label
        </label>
        <input
          id="label"
          name="label"
          defaultValue={workoutSession.label ?? ""}
          disabled={disabled}
          maxLength={100}
          placeholder="Full Body Strength A"
          className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm disabled:opacity-50"
        />
      </div>
      <div className="space-y-1">
        <label htmlFor="warmupNotes" className="text-sm font-medium">
          Warm-up notes
        </label>
        <textarea
          id="warmupNotes"
          name="warmupNotes"
          defaultValue={workoutSession.warmupNotes ?? ""}
          disabled={disabled}
          rows={2}
          className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm disabled:opacity-50"
        />
      </div>
      <div className="space-y-1">
        <label htmlFor="finisherNotes" className="text-sm font-medium">
          Finisher notes
        </label>
        <textarea
          id="finisherNotes"
          name="finisherNotes"
          defaultValue={workoutSession.finisherNotes ?? ""}
          disabled={disabled}
          rows={2}
          className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm disabled:opacity-50"
        />
      </div>
      <div className="space-y-1">
        <label htmlFor="cooldownNotes" className="text-sm font-medium">
          Cool-down notes
        </label>
        <textarea
          id="cooldownNotes"
          name="cooldownNotes"
          defaultValue={workoutSession.cooldownNotes ?? ""}
          disabled={disabled}
          rows={2}
          className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm disabled:opacity-50"
        />
      </div>
      {state?.error && (
        <p className="text-destructive text-sm">{state.error}</p>
      )}
      {state?.success && (
        <p className="text-sm text-green-600 dark:text-green-500">Saved.</p>
      )}
      {!disabled && (
        <button
          type="submit"
          disabled={pending}
          className="bg-primary text-primary-foreground w-full rounded-md px-3 py-2 text-sm font-medium disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save"}
        </button>
      )}
    </form>
  );
}
