"use client";

import { useActionState, useState } from "react";
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
  // Collapsed by default - most exercises don't get a note on a given
  // workout, so don't put an open input between the exercise name and its
  // rounds every single time. An existing note still shows as plain text
  // so prior guidance ("swap band for dumbbells") stays visible, just not
  // as an editable box until explicitly tapped.
  const [editing, setEditing] = useState(false);
  const boundUpdate = updateExerciseNoteAction.bind(
    null,
    sessionId,
    workoutExerciseId,
  );
  const [state, formAction, pending] = useActionState<NoteFormState, FormData>(
    boundUpdate,
    undefined,
  );

  const [prevState, setPrevState] = useState(state);
  if (state !== prevState) {
    setPrevState(state);
    if (state?.success) {
      setEditing(false);
    }
  }

  if (!editing) {
    return initialNote ? (
      <div className="flex items-center gap-2">
        <p className="text-muted-foreground flex-1 text-xs">
          Note: {initialNote}
        </p>
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="text-xs underline"
        >
          Edit
        </button>
      </div>
    ) : (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="text-muted-foreground self-start text-xs underline"
      >
        + Add note
      </button>
    );
  }

  return (
    <form action={formAction} className="flex items-center gap-2">
      <input
        type="text"
        name="noteForNextTime"
        defaultValue={initialNote ?? ""}
        placeholder="Note for next time…"
        maxLength={500}
        autoFocus
        className="border-input bg-background flex-1 rounded-md border px-2 py-1 text-xs"
      />
      <button
        type="submit"
        disabled={pending}
        className="text-xs underline disabled:opacity-50"
      >
        {pending ? "Saving…" : "Save"}
      </button>
      <button
        type="button"
        onClick={() => setEditing(false)}
        className="text-xs underline"
      >
        Cancel
      </button>
      {state?.error && (
        <span className="text-destructive text-xs">{state.error}</span>
      )}
    </form>
  );
}
