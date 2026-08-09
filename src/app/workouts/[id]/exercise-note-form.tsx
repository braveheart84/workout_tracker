"use client";

import { useActionState } from "react";
import { updateExerciseNoteAction, type NoteFormState } from "./block-actions";

export function ExerciseNoteForm({
  sessionId,
  workoutExerciseId,
  initialNote,
}: {
  sessionId: string;
  workoutExerciseId: string;
  initialNote: string | null;
}) {
  const boundUpdate = updateExerciseNoteAction.bind(
    null,
    sessionId,
    workoutExerciseId,
  );
  const [state, formAction, pending] = useActionState<NoteFormState, FormData>(
    boundUpdate,
    undefined,
  );

  return (
    <form action={formAction} className="flex items-center gap-2">
      <input
        type="text"
        name="noteForNextTime"
        defaultValue={initialNote ?? ""}
        placeholder="Note for next time…"
        maxLength={500}
        className="border-input bg-background flex-1 rounded-md border px-2 py-1 text-xs"
      />
      <button
        type="submit"
        disabled={pending}
        className="text-xs underline disabled:opacity-50"
      >
        {pending ? "Saving…" : "Save"}
      </button>
      {state?.error && (
        <span className="text-destructive text-xs">{state.error}</span>
      )}
    </form>
  );
}
