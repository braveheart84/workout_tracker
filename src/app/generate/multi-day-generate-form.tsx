"use client";

import { useActionState, useState } from "react";
import type { WorkoutSuggestion } from "@/lib/workout-suggestion-schema";
import {
  generateWorkoutPlanAction,
  type GeneratePlanFormState,
} from "./actions";
import { DayPlanCard } from "./day-plan-card";

// Evenly-spaced offsets (0-6) into the next 7 days for a given weekly
// workout count, keeping rest days between sessions where the count allows
// it - e.g. 3x/week lands on today, +3, +6 rather than 3 days in a row.
// Hardcoded rather than computed: the domain is small and fixed (1-7
// workouts across a fixed 7-day window), so a lookup table is both simpler
// and more obviously correct than a spacing formula.
const SPACED_OFFSETS_BY_COUNT: Record<number, number[]> = {
  1: [0],
  2: [0, 6],
  3: [0, 3, 6],
  4: [0, 2, 4, 6],
  5: [0, 1, 3, 4, 6],
  6: [0, 1, 2, 4, 5, 6],
  7: [0, 1, 2, 3, 4, 5, 6],
};

function addDaysIso(baseIso: string, offset: number) {
  const date = new Date(`${baseIso}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}

function formatDateLabel(dateIso: string) {
  return new Date(`${dateIso}T00:00:00.000Z`).toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

export function MultiDayGenerateForm({ todayIso }: { todayIso: string }) {
  const [planState, planAction, planPending] = useActionState<
    GeneratePlanFormState,
    FormData
  >(generateWorkoutPlanAction, undefined);

  // PRD 7.2 gives two ways to pick which days to generate for: say how many
  // this week and let the app space them out with rest days in between, or
  // pick the exact days on a calendar (the user usually already knows which
  // days they're free).
  const [scheduleMode, setScheduleMode] = useState<"auto" | "manual">("auto");
  // Raw text the user is typing, kept separate from the clamped number used
  // for scheduling - a controlled input whose value is the clamped result
  // fights the user mid-edit: clearing the field to type "5" collapses to
  // "1" first (since "" clamps to the 1-7 range's minimum), so the next
  // keystroke appends onto "1" instead of starting fresh (e.g. becomes "15",
  // which then clamps to 7). Clamping only happens for the derived
  // `numDays` below and once more on blur, not on every keystroke.
  const [numDaysInput, setNumDaysInput] = useState("3");
  const numDays = Math.min(7, Math.max(1, parseInt(numDaysInput, 10) || 1));
  const [selectedDates, setSelectedDates] = useState<Set<string>>(new Set());

  const autoDates = (SPACED_OFFSETS_BY_COUNT[numDays] ?? [0]).map((offset) =>
    addDaysIso(todayIso, offset),
  );
  const weekDates = Array.from({ length: 7 }, (_, i) =>
    addDaysIso(todayIso, i),
  );

  return (
    <div className="space-y-4">
      <form action={planAction} className="space-y-3">
        <div className="flex gap-3 text-sm">
          <button
            type="button"
            onClick={() => setScheduleMode("auto")}
            className={
              scheduleMode === "auto"
                ? "font-semibold underline"
                : "text-muted-foreground underline"
            }
          >
            This week
          </button>
          <button
            type="button"
            onClick={() => setScheduleMode("manual")}
            className={
              scheduleMode === "manual"
                ? "font-semibold underline"
                : "text-muted-foreground underline"
            }
          >
            Pick specific days
          </button>
        </div>

        {scheduleMode === "auto" ? (
          <div className="space-y-1">
            <label htmlFor="numDays" className="text-sm font-medium">
              How many workouts this week?
            </label>
            <input
              id="numDays"
              type="number"
              min={1}
              max={7}
              value={numDaysInput}
              onChange={(e) => setNumDaysInput(e.target.value)}
              onBlur={() => setNumDaysInput(String(numDays))}
              className="border-input bg-background w-20 rounded-md border px-3 py-2 text-sm"
            />
            <p className="text-muted-foreground text-xs">
              We&apos;ll space them across the next 7 days with rest days in
              between: {autoDates.map(formatDateLabel).join(", ")}.
            </p>
            {autoDates.map((dateIso) => (
              <input key={dateIso} type="hidden" name="dates" value={dateIso} />
            ))}
          </div>
        ) : (
          <div className="space-y-1">
            <label className="text-sm font-medium">Which days?</label>
            <div className="space-y-1">
              {weekDates.map((dateIso) => (
                <label
                  key={dateIso}
                  className="flex items-center gap-2 text-sm"
                >
                  <input
                    type="checkbox"
                    name="dates"
                    value={dateIso}
                    checked={selectedDates.has(dateIso)}
                    onChange={(e) => {
                      setSelectedDates((prev) => {
                        const next = new Set(prev);
                        if (e.target.checked) {
                          next.add(dateIso);
                        } else {
                          next.delete(dateIso);
                        }
                        return next;
                      });
                    }}
                  />
                  {formatDateLabel(dateIso)}
                </label>
              ))}
            </div>
          </div>
        )}

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
          disabled={
            planPending ||
            (scheduleMode === "manual" && selectedDates.size === 0)
          }
          className="bg-primary text-primary-foreground w-full rounded-md px-3 py-2 text-sm font-medium disabled:opacity-50"
        >
          {planPending
            ? "Generating…"
            : planState?.days
              ? "Regenerate Plan"
              : "Generate Plan"}
        </button>
      </form>

      {planState?.days && planState.planId && planState.dates && (
        <MultiDayPlanReview
          days={planState.days}
          planId={planState.planId}
          dates={planState.dates}
        />
      )}
    </div>
  );
}

// Split out so planId/dates are destructured props, not property accesses
// on the parent's optional planState - TypeScript can't carry a narrowing
// on `planState.planId` through into a .map() closure, since it can't
// guarantee the object's properties don't change by the time the closure
// runs.
function MultiDayPlanReview({
  days,
  planId,
  dates,
}: {
  days: WorkoutSuggestion[];
  planId: string;
  dates: string[];
}) {
  return (
    <div className="space-y-4">
      {days.map((day, index) => {
        const dateIso = dates[index];

        return (
          <DayPlanCard
            key={`${planId}-${dateIso}`}
            planId={planId}
            dateIso={dateIso}
            dateLabel={formatDateLabel(dateIso)}
            initialSuggestion={day}
          />
        );
      })}
    </div>
  );
}
