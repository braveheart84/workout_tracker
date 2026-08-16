"use client";

import { deleteWorkoutSessionAction } from "../actions";

export function DeleteWorkoutButton({ sessionId }: { sessionId: string }) {
  return (
    <form
      action={deleteWorkoutSessionAction.bind(null, sessionId)}
      onSubmit={(e) => {
        if (!confirm("Delete this workout? This can't be undone.")) {
          e.preventDefault();
        }
      }}
    >
      <button
        type="submit"
        className="text-destructive w-full rounded-md border px-3 py-2 text-sm font-medium"
      >
        Delete Workout
      </button>
    </form>
  );
}
