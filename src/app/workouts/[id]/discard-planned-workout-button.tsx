"use client";

import { discardPlannedWorkoutAction } from "../actions";

export function DiscardPlannedWorkoutButton({
  sessionId,
}: {
  sessionId: string;
}) {
  return (
    <form
      action={discardPlannedWorkoutAction.bind(null, sessionId)}
      onSubmit={(e) => {
        if (!confirm("Discard this planned workout? This can't be undone.")) {
          e.preventDefault();
        }
      }}
    >
      <button
        type="submit"
        className="text-destructive w-full rounded-md border px-3 py-2 text-sm font-medium"
      >
        Discard Planned Workout
      </button>
    </form>
  );
}
