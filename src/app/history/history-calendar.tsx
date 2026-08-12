"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DIFFICULTY_LABELS } from "@/lib/difficulty";

export type DaySession = {
  id: string;
  status: "IN_PROGRESS" | "PLANNED" | "COMPLETED" | "DISCARDED";
  label: string | null;
  type: "STRENGTH" | "RUN";
  exerciseCount: number;
  setCount: number;
  difficultyRating: number | null;
};

const STATUS_DOT: Record<DaySession["status"], string> = {
  IN_PROGRESS: "bg-primary",
  PLANNED: "bg-primary",
  COMPLETED: "bg-emerald-500",
  DISCARDED: "bg-muted-foreground/40",
};

// Priority for which session's status "wins" the day's dot when a date has
// more than one row (e.g. a discarded plan plus the ad-hoc workout that
// replaced it) - same ordering already used for the week view's per-day
// summary.
const STATUS_PRIORITY: DaySession["status"][] = [
  "IN_PROGRESS",
  "PLANNED",
  "COMPLETED",
  "DISCARDED",
];

function dominantStatus(
  daySessions: DaySession[],
): DaySession["status"] | null {
  for (const status of STATUS_PRIORITY) {
    if (daySessions.some((s) => s.status === status)) return status;
  }
  return null;
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function monthKey(year: number, month: number) {
  return `${year}-${pad2(month + 1)}`;
}

function getMonthCells(year: number, month: number) {
  const firstOfMonth = new Date(Date.UTC(year, month, 1));
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  // Monday-start week: getUTCDay() is 0 (Sun) - 6 (Sat); shift so Monday = 0.
  const leading = (firstOfMonth.getUTCDay() + 6) % 7;
  return [
    ...Array<null>(leading).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
}

const WEEKDAY_HEADERS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

// Calendar-style nav redesign: a month grid with status dots instead of a
// flat scrolling list - lets the user spot streaks/gaps at a glance, and
// paging back a month is a lot more direct than scrolling past 50 rows.
// Sessions for the whole fetched range are passed down once and grouped
// by date client-side, so switching months is instant with no refetch.
export function HistoryCalendar({
  sessionsByDate,
  todayIso,
  minMonthKey,
  maxMonthKey,
}: {
  sessionsByDate: Record<string, DaySession[]>;
  todayIso: string;
  minMonthKey: string;
  maxMonthKey: string;
}) {
  const [today] = useState(() => new Date(`${todayIso}T00:00:00.000Z`));
  const [viewedYear, setViewedYear] = useState(today.getUTCFullYear());
  const [viewedMonth, setViewedMonth] = useState(today.getUTCMonth());
  const [selectedDateIso, setSelectedDateIso] = useState(todayIso);

  const cells = getMonthCells(viewedYear, viewedMonth);
  const currentMonthKey = monthKey(viewedYear, viewedMonth);
  const monthLabel = new Date(
    Date.UTC(viewedYear, viewedMonth, 1),
  ).toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

  function goToMonth(delta: number) {
    const next = new Date(Date.UTC(viewedYear, viewedMonth + delta, 1));
    setViewedYear(next.getUTCFullYear());
    setViewedMonth(next.getUTCMonth());
  }

  const canGoPrev = monthKey(viewedYear, viewedMonth - 1) >= minMonthKey;
  const canGoNext = monthKey(viewedYear, viewedMonth + 1) <= maxMonthKey;

  const selectedSessions = sessionsByDate[selectedDateIso] ?? [];
  const selectedLabel = new Date(
    `${selectedDateIso}T00:00:00.000Z`,
  ).toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });

  return (
    <div className="space-y-4">
      <div className="space-y-2 rounded-md border p-4">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => goToMonth(-1)}
            disabled={!canGoPrev}
            aria-label="Previous month"
            className="p-1 disabled:opacity-30"
          >
            <ChevronLeft size={18} />
          </button>
          <p className="text-sm font-semibold">{monthLabel}</p>
          <button
            type="button"
            onClick={() => goToMonth(1)}
            disabled={!canGoNext}
            aria-label="Next month"
            className="p-1 disabled:opacity-30"
          >
            <ChevronRight size={18} />
          </button>
        </div>

        <div className="text-muted-foreground grid grid-cols-7 gap-1 text-center text-[10px] font-medium">
          {WEEKDAY_HEADERS.map((d) => (
            <div key={d}>{d}</div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {cells.map((day, i) => {
            if (day === null) return <div key={`blank-${i}`} />;
            const dateIso = `${currentMonthKey}-${pad2(day)}`;
            const daySessions = sessionsByDate[dateIso] ?? [];
            const status = dominantStatus(daySessions);
            const isSelected = dateIso === selectedDateIso;
            const isToday = dateIso === todayIso;

            return (
              <button
                key={dateIso}
                type="button"
                onClick={() => setSelectedDateIso(dateIso)}
                className={
                  isSelected
                    ? "bg-primary text-primary-foreground flex aspect-square flex-col items-center justify-center gap-0.5 rounded-lg text-xs font-semibold"
                    : isToday
                      ? "border-primary flex aspect-square flex-col items-center justify-center gap-0.5 rounded-lg border-2 text-xs"
                      : "flex aspect-square flex-col items-center justify-center gap-0.5 rounded-lg text-xs"
                }
              >
                {day}
                <span className="block h-1 w-1">
                  {status && !isSelected && (
                    <span
                      className={`block h-1 w-1 rounded-full ${STATUS_DOT[status]}`}
                    />
                  )}
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-4 border-t pt-3 text-[11px]">
          <span className="flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Completed
          </span>
          <span className="flex items-center gap-1">
            <span className="bg-primary h-1.5 w-1.5 rounded-full" />
            Planned
          </span>
          <span className="flex items-center gap-1">
            <span className="bg-muted-foreground/40 h-1.5 w-1.5 rounded-full" />
            Discarded
          </span>
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium">{selectedLabel}</p>
        {selectedSessions.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            No workout logged this day.
          </p>
        ) : (
          <ul className="space-y-2">
            {selectedSessions.map((s) => (
              <li key={s.id}>
                <Link
                  href={`/workouts/${s.id}`}
                  className="hover:bg-muted/30 block space-y-1 rounded-md border p-3 text-sm"
                >
                  <span className="font-medium">{s.label || "Workout"}</span>
                  <p className="text-muted-foreground text-xs">
                    {s.status === "PLANNED"
                      ? "Planned"
                      : s.status === "IN_PROGRESS"
                        ? "In progress"
                        : s.status === "DISCARDED"
                          ? "Discarded"
                          : s.type === "STRENGTH"
                            ? "Strength"
                            : "Run"}
                    {s.status === "COMPLETED" &&
                      ` · ${s.exerciseCount} exercise${s.exerciseCount === 1 ? "" : "s"} · ${s.setCount} set${s.setCount === 1 ? "" : "s"}`}
                    {s.difficultyRating != null &&
                      ` · Difficulty: ${s.difficultyRating}/5 (${DIFFICULTY_LABELS[s.difficultyRating - 1]})`}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
