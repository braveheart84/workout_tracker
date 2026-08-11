"use client";

import { useActionState } from "react";
import type { WorkoutSuggestion } from "@/lib/workout-suggestion-schema";
import {
  generateWorkoutPlanAction,
  type GeneratePlanFormState,
} from "./actions";
import { DayPlanCard } from "./day-plan-card";

export function MultiDayGenerateForm() {
  const [planState, planAction, planPending] = useActionState<
    GeneratePlanFormState,
    FormData
  >(generateWorkoutPlanAction, undefined);

  return (
    <div className="space-y-4">
      <form action={planAction} className="space-y-3">
        <div className="space-y-1">
          <label htmlFor="numDays" className="text-sm font-medium">
            How many days?
          </label>
          <input
            id="numDays"
            type="number"
            name="numDays"
            min={1}
            max={7}
            defaultValue={3}
            className="border-input bg-background w-20 rounded-md border px-3 py-2 text-sm"
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="planFreeText" className="text-sm font-medium">
            How are you feeling? What do you want to work on this week?
            (optional)
          </label>
          <textarea
            id="planFreeText"
            name="freeText"
            rows={3}
            maxLength={1000}
            placeholder="e.g. want to hit legs hard this week, keep the rest light"
            className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
          />
        </div>
        {planState?.error && (
          <p className="text-destructive text-sm">{planState.error}</p>
        )}
        <button
          type="submit"
          disabled={planPending}
          className="bg-primary text-primary-foreground w-full rounded-md px-3 py-2 text-sm font-medium disabled:opacity-50"
        >
          {planPending
            ? "Generating…"
            : planState?.days
              ? "Regenerate Plan"
              : "Generate Plan"}
        </button>
      </form>

      {planState?.days && planState.planId && planState.startIso && (
        <MultiDayPlanReview
          days={planState.days}
          planId={planState.planId}
          startIso={planState.startIso}
        />
      )}
    </div>
  );
}

// Split out so planId/startIso are destructured props, not property
// accesses on the parent's optional planState - TypeScript can't carry a
// narrowing on `planState.planId` through into a .map() closure, since it
// can't guarantee the object's properties don't change by the time the
// closure runs.
function MultiDayPlanReview({
  days,
  planId,
  startIso,
}: {
  days: WorkoutSuggestion[];
  planId: string;
  startIso: string;
}) {
  return (
    <div className="space-y-4">
      {days.map((day, index) => {
        const date = new Date(`${startIso}T00:00:00.000Z`);
        date.setUTCDate(date.getUTCDate() + index);
        const dateIso = date.toISOString().slice(0, 10);
        const dateLabel = date.toLocaleDateString(undefined, {
          weekday: "long",
          month: "short",
          day: "numeric",
          timeZone: "UTC",
        });

        return (
          <DayPlanCard
            key={`${planId}-${index}`}
            planId={planId}
            dateIso={dateIso}
            dateLabel={dateLabel}
            initialSuggestion={day}
          />
        );
      })}
    </div>
  );
}
