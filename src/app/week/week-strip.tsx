"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { Sparkles, Plus } from "lucide-react";
import type { WorkoutSession } from "@/generated/prisma/client";
import {
  startAdHocWorkoutAction,
  reschedulePlannedSessionAction,
  type RescheduleFormState,
} from "@/app/workouts/actions";

const STATUS_ACTION_LABEL = {
  IN_PROGRESS: "Continue",
  PLANNED: "View & Start",
  COMPLETED: "View",
} as const;

const STATUS_DOT: Record<string, string> = {
  IN_PROGRESS: "bg-primary",
  PLANNED: "bg-primary",
  COMPLETED: "bg-emerald-500",
  DISCARDED: "bg-muted-foreground/40",
};

export type WeekDay = {
  date: Date;
  dateIso: string;
  isToday: boolean;
  primary: WorkoutSession | null;
  discardedCount: number;
};

// The primary action (View & Start / Continue / View) plus, for a still-
// PLANNED day, an inline Reschedule control beside it - a separate
// component (rather than inline in WeekStrip) so its expand/collapse and
// form state reset cleanly via the `key={primary.id}` below when the
// selected day changes, instead of carrying stale state across days.
function PrimarySessionActions({
  primary,
  todayIso,
}: {
  primary: WorkoutSession;
  todayIso: string;
}) {
  const [rescheduling, setRescheduling] = useState(false);
  const boundReschedule = reschedulePlannedSessionAction.bind(null, primary.id);
  const [state, formAction, pending] = useActionState<
    RescheduleFormState,
    FormData
  >(boundReschedule, undefined);
  const isPlanned = primary.status === "PLANNED";

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <Link
          href={`/workouts/${primary.id}`}
          className="bg-primary text-primary-foreground inline-block rounded-md px-4 py-2 text-sm font-medium"
        >
          {STATUS_ACTION_LABEL[
            primary.status as keyof typeof STATUS_ACTION_LABEL
          ] ?? "View"}
        </Link>
        {isPlanned && !rescheduling && (
          <button
            type="button"
            onClick={() => setRescheduling(true)}
            className="border-input rounded-md border px-4 py-2 text-sm font-medium"
          >
            Reschedule
          </button>
        )}
      </div>
      {isPlanned && rescheduling && (
        <form action={formAction} className="flex flex-wrap items-center gap-2">
          <input
            type="date"
            name="date"
            defaultValue={primary.date.toISOString().slice(0, 10)}
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
            onClick={() => setRescheduling(false)}
            className="text-xs underline"
          >
            Cancel
          </button>
        </form>
      )}
      {state?.error && (
        <p className="text-destructive text-xs">{state.error}</p>
      )}
    </div>
  );
}

// Calendar-style nav redesign: a horizontal day-strip (like a calendar
// week header) instead of a vertical list of 7 cards - the strip shows
// all 7 days' status at a glance via a colored dot, and picking a day
// swaps the detail panel below it rather than requiring a scroll through
// every day's card.
export function WeekStrip({
  days,
  todayIso,
}: {
  days: WeekDay[];
  todayIso: string;
}) {
  const [selectedIso, setSelectedIso] = useState(
    days.find((d) => d.isToday)?.dateIso ?? days[0].dateIso,
  );
  const selected = days.find((d) => d.dateIso === selectedIso) ?? days[0];

  return (
    <div className="space-y-4">
      <div className="flex justify-between">
        {days.map((day) => {
          const dotStatus =
            day.primary?.status ??
            (day.discardedCount > 0 ? "DISCARDED" : null);
          const isSelected = day.dateIso === selectedIso;

          return (
            <button
              key={day.dateIso}
              type="button"
              onClick={() => setSelectedIso(day.dateIso)}
              className="flex flex-col items-center gap-1.5"
            >
              <span className="text-muted-foreground text-[10px] font-medium tracking-wide uppercase">
                {day.date.toLocaleDateString(undefined, {
                  weekday: "short",
                  timeZone: "UTC",
                })}
              </span>
              <span
                className={
                  isSelected
                    ? "bg-primary text-primary-foreground flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold"
                    : day.isToday
                      ? "border-primary flex h-10 w-10 items-center justify-center rounded-full border-2 text-sm font-medium"
                      : "flex h-10 w-10 items-center justify-center rounded-full border text-sm font-medium"
                }
              >
                {day.date.getUTCDate()}
              </span>
              <span className="block h-1.5 w-1.5">
                {dotStatus && (
                  <span
                    className={`block h-1.5 w-1.5 rounded-full ${STATUS_DOT[dotStatus]}`}
                  />
                )}
              </span>
            </button>
          );
        })}
      </div>

      <div className="space-y-2 rounded-md border p-4">
        <p className="text-sm font-medium">
          {selected.date.toLocaleDateString(undefined, {
            weekday: "long",
            month: "short",
            day: "numeric",
            timeZone: "UTC",
          })}
          {selected.isToday && (
            <span className="text-muted-foreground"> (Today)</span>
          )}
        </p>

        {selected.primary ? (
          <div className="space-y-2">
            <p className="font-medium">{selected.primary.label || "Workout"}</p>
            <PrimarySessionActions
              key={selected.primary.id}
              primary={selected.primary}
              todayIso={todayIso}
            />
          </div>
        ) : (
          <div className="space-y-3">
            <p className="font-medium">
              No workout planned yet
              {selected.discardedCount > 0 &&
                ` (${selected.discardedCount} discarded)`}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href={`/generate?date=${selected.dateIso}`}
                className="bg-primary text-primary-foreground flex items-center gap-1.5 rounded-md px-4 py-2 text-sm font-medium"
              >
                <Sparkles className="h-4 w-4" />
                Generate
              </Link>
              {selected.isToday ? (
                <form action={startAdHocWorkoutAction}>
                  <button
                    type="submit"
                    className="border-input flex items-center gap-1.5 rounded-md border px-4 py-2 text-sm font-medium"
                  >
                    <Plus className="h-4 w-4" />
                    Ad-hoc
                  </button>
                </form>
              ) : (
                <p className="text-muted-foreground text-xs">
                  Ad-hoc start is only available for today.
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
