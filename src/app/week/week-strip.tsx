"use client";

import { useState } from "react";
import Link from "next/link";
import type { WorkoutSession } from "@/generated/prisma/client";
import { startAdHocWorkoutAction } from "@/app/workouts/actions";

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

// Calendar-style nav redesign: a horizontal day-strip (like a calendar
// week header) instead of a vertical list of 7 cards - the strip shows
// all 7 days' status at a glance via a colored dot, and picking a day
// swaps the detail panel below it rather than requiring a scroll through
// every day's card.
export function WeekStrip({ days }: { days: WeekDay[] }) {
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
          <Link
            href={`/workouts/${selected.primary.id}`}
            className="text-sm underline"
          >
            {STATUS_ACTION_LABEL[
              selected.primary.status as keyof typeof STATUS_ACTION_LABEL
            ] ?? "View"}{" "}
            — {selected.primary.label || "Workout"}
          </Link>
        ) : (
          <div className="space-y-2">
            <p className="text-muted-foreground text-sm">
              No workout planned.
              {selected.discardedCount > 0 &&
                ` (${selected.discardedCount} discarded)`}
            </p>
            <div className="flex gap-3 text-sm">
              <Link
                href={`/generate?date=${selected.dateIso}`}
                className="underline"
              >
                Generate
              </Link>
              {selected.isToday && (
                <form action={startAdHocWorkoutAction}>
                  <button type="submit" className="underline">
                    Start ad-hoc
                  </button>
                </form>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
