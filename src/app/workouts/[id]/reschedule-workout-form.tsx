"use client";

import { useActionState, useState } from "react";
import {
  reschedulePlannedSessionAction,
  type RescheduleFormState,
} from "../actions";

export function RescheduleWorkoutForm({
  sessionId,
  currentDateIso,
  todayIso,
}: {
  sessionId: string;
  currentDateIso: string;
  todayIso: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const boundReschedule = reschedulePlannedSessionAction.bind(null, sessionId);
  const [state, formAction, pending] = useActionState<
    RescheduleFormState,
    FormData
  >(boundReschedule, undefined);

  if (!expanded) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        className="border-input w-full rounded-md border px-3 py-2 text-sm font-medium"
      >
        Reschedule
      </button>
    );
  }

  return (
    <form action={formAction} className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="date"
          name="date"
          defaultValue={currentDateIso}
          min={todayIso}
          className="border-input bg-background rounded-md border px-2 py-1 text-sm"
        />
        <button
          type="submit"
          disabled={pending}
          className="border-input rounded-md border px-3 py-1 text-sm font-medium disabled:opacity-50"
        >
          {pending ? "Rescheduling…" : "Save"}
        </button>
        <button
          type="button"
          onClick={() => setExpanded(false)}
          className="text-xs underline"
        >
          Cancel
        </button>
      </div>
      {state?.error && (
        <p className="text-destructive text-xs">{state.error}</p>
      )}
    </form>
  );
}
