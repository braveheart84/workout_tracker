"use client";

import { useActionState } from "react";
import {
  rescheduleSkippedSessionAction,
  discardSkippedSessionAction,
  type RescheduleFormState,
} from "@/app/workouts/actions";

type SkippedSession = {
  id: string;
  label: string | null;
  date: Date;
};

// PRD 7.3: a planned day's date passing without the session ever being
// started shouldn't just silently pile up - surfaced here since the
// dashboard is "the next time the user opens the app."
export function SkippedDayBanner({
  sessions,
  todayIso,
}: {
  sessions: SkippedSession[];
  todayIso: string;
}) {
  if (sessions.length === 0) {
    return null;
  }

  return (
    <div className="w-full max-w-lg space-y-3 rounded-md border border-amber-500/50 bg-amber-500/10 p-4 text-left">
      <p className="text-sm font-medium">
        {sessions.length === 1
          ? "You have a missed planned workout."
          : `You have ${sessions.length} missed planned workouts.`}
      </p>
      <div className="space-y-3">
        {sessions.map((s) => (
          <SkippedDayCard key={s.id} session={s} todayIso={todayIso} />
        ))}
      </div>
    </div>
  );
}

function SkippedDayCard({
  session,
  todayIso,
}: {
  session: SkippedSession;
  todayIso: string;
}) {
  const boundReschedule = rescheduleSkippedSessionAction.bind(null, session.id);
  const [state, formAction, pending] = useActionState<
    RescheduleFormState,
    FormData
  >(boundReschedule, undefined);

  return (
    <div className="bg-background space-y-2 rounded-md border p-3 text-sm">
      <p>
        {session.label || "Workout"} was planned for{" "}
        {session.date.toLocaleDateString(undefined, { timeZone: "UTC" })} but
        never started.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <form action={formAction} className="flex flex-wrap items-center gap-2">
          <input
            type="date"
            name="date"
            defaultValue={todayIso}
            min={todayIso}
            className="border-input bg-background rounded-md border px-2 py-1 text-sm"
          />
          <button
            type="submit"
            disabled={pending}
            className="border-input rounded-md border px-3 py-1 text-sm font-medium disabled:opacity-50"
          >
            {pending ? "Rescheduling…" : "Reschedule"}
          </button>
        </form>
        <form
          action={discardSkippedSessionAction.bind(null, session.id)}
          onSubmit={(e) => {
            if (!confirm("Discard this planned workout?")) {
              e.preventDefault();
            }
          }}
        >
          <button type="submit" className="text-destructive text-xs underline">
            Discard
          </button>
        </form>
      </div>
      {state?.error && (
        <p className="text-destructive text-xs">{state.error}</p>
      )}
    </div>
  );
}
