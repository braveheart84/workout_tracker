"use client";

import { useTransition } from "react";
import { startPlannedWorkoutAction } from "../actions";

// A plain server-action-bound <form> would submit and re-render in place,
// leaving the user right where they clicked - below the (now scrollable)
// blocks list, since this button sits after them. Calling the action
// directly from a click handler instead lets a scroll happen once it
// resolves and the page has re-rendered as in-progress.
export function StartWorkoutButton({ sessionId }: { sessionId: string }) {
  const [pending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      await startPlannedWorkoutAction(sessionId);
      document
        .getElementById("blocks")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      className="bg-primary text-primary-foreground w-full rounded-md px-3 py-2 text-sm font-medium disabled:opacity-50"
    >
      {pending ? "Starting…" : "Start Workout"}
    </button>
  );
}
