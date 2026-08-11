import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { startAdHocWorkoutAction } from "@/app/workouts/actions";
import { BottomNav } from "@/components/bottom-nav";

const STATUS_ACTION_LABEL = {
  IN_PROGRESS: "Continue",
  PLANNED: "View & Start",
  COMPLETED: "View",
} as const;

export default async function WeekPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const now = new Date();
  const weekStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  const weekEnd = new Date(weekStart);
  weekEnd.setUTCDate(weekEnd.getUTCDate() + 7);

  const sessions = await prisma.workoutSession.findMany({
    where: {
      userId: session.user.id,
      date: { gte: weekStart, lt: weekEnd },
    },
    orderBy: { createdAt: "desc" },
  });

  const days = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(weekStart);
    date.setUTCDate(date.getUTCDate() + i);
    const dateIso = date.toISOString().slice(0, 10);
    const daySessions = sessions.filter(
      (s) => s.date.toISOString().slice(0, 10) === dateIso,
    );
    // PRD 7.3: "days with no planned or logged workout are visually
    // distinguished" - a day whose only session is DISCARDED still counts
    // as available, same as a day with nothing at all.
    const primary =
      daySessions.find((s) => s.status === "IN_PROGRESS") ??
      daySessions.find((s) => s.status === "PLANNED") ??
      daySessions.find((s) => s.status === "COMPLETED") ??
      null;
    const discardedCount = daySessions.filter(
      (s) => s.status === "DISCARDED",
    ).length;

    return { date, dateIso, isToday: i === 0, primary, discardedCount };
  });

  return (
    <main className="flex flex-1 flex-col items-center gap-6 p-8">
      <div className="w-full max-w-lg space-y-6">
        <h1 className="text-2xl font-semibold tracking-tight">This Week</h1>

        <ul className="space-y-3">
          {days.map((day) => (
            <li
              key={day.dateIso}
              className={
                day.primary
                  ? "space-y-2 rounded-md border p-4"
                  : "space-y-2 rounded-md border border-dashed p-4"
              }
            >
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">
                  {day.date.toLocaleDateString(undefined, {
                    weekday: "long",
                    month: "short",
                    day: "numeric",
                    timeZone: "UTC",
                  })}
                  {day.isToday && (
                    <span className="text-muted-foreground"> (Today)</span>
                  )}
                </p>
              </div>

              {day.primary ? (
                <Link
                  href={`/workouts/${day.primary.id}`}
                  className="text-sm underline"
                >
                  {STATUS_ACTION_LABEL[
                    day.primary.status as keyof typeof STATUS_ACTION_LABEL
                  ] ?? "View"}{" "}
                  — {day.primary.label || "Workout"}
                </Link>
              ) : (
                <div className="space-y-2">
                  <p className="text-muted-foreground text-sm">
                    No workout planned.
                    {day.discardedCount > 0 &&
                      ` (${day.discardedCount} discarded)`}
                  </p>
                  <div className="flex gap-3 text-sm">
                    <Link
                      href={`/generate?date=${day.dateIso}`}
                      className="underline"
                    >
                      Generate
                    </Link>
                    {day.isToday && (
                      <form action={startAdHocWorkoutAction}>
                        <button type="submit" className="underline">
                          Start ad-hoc
                        </button>
                      </form>
                    )}
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
        <div className="h-20" aria-hidden="true" />
      </div>
      <BottomNav />
    </main>
  );
}
