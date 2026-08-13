"use client";

import { useActionState, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
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
  // Most workouts never get a custom label or warm-up/finisher/cool-down
  // notes, so don't force everyone to see (and scroll past) four fields
  // before reaching their actual sets every single time. Collapsed by
  // default; already-filled-in details still show up front rather than
  // being hidden behind a click.
  const hasExistingDetails = Boolean(
    workoutSession.label ||
    workoutSession.warmupNotes ||
    workoutSession.finisherNotes ||
    workoutSession.cooldownNotes,
  );
  const [expanded, setExpanded] = useState(hasExistingDetails);
  const boundUpdate = updateWorkoutSessionAction.bind(null, workoutSession.id);
  const [state, formAction, pending] = useActionState<
    WorkoutSessionFormState,
    FormData
  >(boundUpdate, undefined);

  if (!expanded) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        className="text-muted-foreground flex items-center gap-1 text-sm underline"
      >
        <ChevronRight className="h-4 w-4" />
        Label & notes
      </button>
    );
  }

  return (
    <form action={formAction} className="space-y-4 rounded-md border p-4">
      <button
        type="button"
        onClick={() => setExpanded(false)}
        className="text-muted-foreground flex items-center gap-1 text-sm underline"
      >
        <ChevronDown className="h-4 w-4" />
        Label & notes
      </button>
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
        <label htmlFor="warmupNotes" className="text-lg font-medium">
          Warm-up notes
        </label>
        <textarea
          id="warmupNotes"
          name="warmupNotes"
          defaultValue={workoutSession.warmupNotes ?? ""}
          disabled={disabled}
          rows={2}
          style={{ fontSize: "22px" }}
          className="border-input bg-background w-full rounded-md border px-3 py-2 disabled:opacity-50"
        />
      </div>
      <div className="space-y-1">
        <label htmlFor="finisherNotes" className="text-lg font-medium">
          Finisher notes
        </label>
        <textarea
          id="finisherNotes"
          name="finisherNotes"
          defaultValue={workoutSession.finisherNotes ?? ""}
          disabled={disabled}
          rows={2}
          style={{ fontSize: "22px" }}
          className="border-input bg-background w-full rounded-md border px-3 py-2 disabled:opacity-50"
        />
      </div>
      <div className="space-y-1">
        <label htmlFor="cooldownNotes" className="text-lg font-medium">
          Cool-down notes
        </label>
        <textarea
          id="cooldownNotes"
          name="cooldownNotes"
          defaultValue={workoutSession.cooldownNotes ?? ""}
          disabled={disabled}
          rows={2}
          style={{ fontSize: "22px" }}
          className="border-input bg-background w-full rounded-md border px-3 py-2 disabled:opacity-50"
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
