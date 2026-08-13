import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Dumbbell,
  CheckCircle2,
  Sparkles,
  Play,
  Plus,
  ChevronRight,
} from "lucide-react";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { startAdHocWorkoutAction } from "@/app/workouts/actions";
import { BottomNav } from "@/components/bottom-nav";
import { getUserTimezone, todayInTimezone } from "@/lib/user-date";
import { SkippedDayBanner } from "./skipped-day-banner";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const user = await prisma.user.findUniqueOrThrow({
    where: { id: session.user.id },
    select: { name: true, onboardingCompletedAt: true },
  });
  if (!user.onboardingCompletedAt) {
    redirect("/onboarding");
  }

  const timezone = await getUserTimezone();
  const todayStart = todayInTimezone(timezone);
  const tomorrowStart = new Date(todayStart);
  tomorrowStart.setUTCDate(tomorrowStart.getUTCDate() + 1);
  const todayIso = todayStart.toISOString().slice(0, 10);

  // Monday-start week containing today, for the "this week" progress row -
  // same convention as the History calendar, rather than /week's rolling
  // today-plus-6-days window (that's for planning ahead; this is for
  // glancing back at what's already been done this week).
  const dayOfWeek = (todayStart.getUTCDay() + 6) % 7;
  const weekStart = new Date(todayStart);
  weekStart.setUTCDate(weekStart.getUTCDate() - dayOfWeek);
  const weekEnd = new Date(weekStart);
  weekEnd.setUTCDate(weekEnd.getUTCDate() + 7);

  // Matches the 60-day window generate/page.tsx uses to offer "repeat a
  // previous workout" baselines - no point linking to "Repeat Last Week"
  // if the multi-day form it lands on would have nothing to offer.
  const sixtyDaysAgo = new Date(todayStart);
  sixtyDaysAgo.setUTCDate(sixtyDaysAgo.getUTCDate() - 60);

  const [
    todaysSessions,
    skippedSessions,
    weekCompletedSessions,
    lastCompletedSession,
  ] = await Promise.all([
    prisma.workoutSession.findMany({
      where: {
        userId: session.user.id,
        date: { gte: todayStart, lt: tomorrowStart },
      },
      orderBy: { createdAt: "desc" },
      include: {
        blocks: { include: { workoutExercises: { select: { id: true } } } },
      },
    }),
    prisma.workoutSession.findMany({
      where: {
        userId: session.user.id,
        status: "PLANNED",
        date: { lt: todayStart },
      },
      orderBy: { date: "asc" },
    }),
    prisma.workoutSession.findMany({
      where: {
        userId: session.user.id,
        status: "COMPLETED",
        date: { gte: weekStart, lt: weekEnd },
      },
      select: { date: true },
    }),
    prisma.workoutSession.findFirst({
      where: {
        userId: session.user.id,
        status: "COMPLETED",
        date: { gte: sixtyDaysAgo, lt: todayStart },
      },
      orderBy: { date: "desc" },
      select: { date: true, label: true },
    }),
  ]);

  const inProgress = todaysSessions.find((s) => s.status === "IN_PROGRESS");
  const planned = todaysSessions.find((s) => s.status === "PLANNED");
  const completed = todaysSessions.find((s) => s.status === "COMPLETED");
  const active = inProgress ?? planned ?? completed ?? null;
  const blockCount = active?.blocks.length ?? 0;
  const exerciseCount =
    active?.blocks.reduce((sum, b) => sum + b.workoutExercises.length, 0) ?? 0;
  const sessionMeta = active
    ? `${blockCount} block${blockCount === 1 ? "" : "s"} · ${exerciseCount} exercise${exerciseCount === 1 ? "" : "s"}`
    : null;

  const completedDates = new Set(
    weekCompletedSessions.map((s) => s.date.toISOString().slice(0, 10)),
  );
  const weekChips = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(weekStart);
    date.setUTCDate(date.getUTCDate() + i);
    const dateIso = date.toISOString().slice(0, 10);
    return {
      dateIso,
      dayLabel: date.toLocaleDateString(undefined, {
        weekday: "narrow",
        timeZone: "UTC",
      }),
      isToday: dateIso === todayIso,
      isCompleted: completedDates.has(dateIso),
    };
  });

  const todayLabel = todayStart.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });

  return (
    <main className="flex flex-1 flex-col gap-6 p-6">
      <div>
        <p className="text-muted-foreground text-sm">{todayLabel}</p>
        <h1 className="text-2xl font-semibold tracking-tight">
          {user.name ? `Welcome back, ${user.name}` : "Welcome back"}
        </h1>
      </div>

      <SkippedDayBanner sessions={skippedSessions} todayIso={todayIso} />

      <Link href="/week" className="block space-y-3 rounded-md border p-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">This week</p>
          <ChevronRight className="text-muted-foreground h-4 w-4" />
        </div>
        <div className="flex justify-between">
          {weekChips.map((day) => (
            <div
              key={day.dateIso}
              className="flex flex-col items-center gap-1.5"
            >
              <span className="text-muted-foreground text-[10px] font-medium tracking-wide uppercase">
                {day.dayLabel}
              </span>
              <span
                className={
                  day.isToday
                    ? "border-primary flex h-8 w-8 items-center justify-center rounded-full border-2"
                    : "flex h-8 w-8 items-center justify-center rounded-full"
                }
              >
                {day.isCompleted ? (
                  <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                ) : day.isToday ? (
                  <span className="bg-primary h-2 w-2 rounded-full" />
                ) : (
                  <span className="bg-muted h-2 w-2 rounded-full" />
                )}
              </span>
            </div>
          ))}
        </div>
      </Link>

      {inProgress ? (
        <div className="border-primary flex items-start gap-3 rounded-md border-l-4 p-4 shadow-sm">
          <div className="bg-primary/10 text-primary rounded-full p-2">
            <Dumbbell className="h-5 w-5" />
          </div>
          <div className="flex-1 space-y-1">
            <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
              In progress
            </p>
            <p className="text-lg font-semibold">
              {inProgress.label || "Workout"}
            </p>
            {sessionMeta && (
              <p className="text-muted-foreground text-sm">{sessionMeta}</p>
            )}
            <Link
              href={`/workouts/${inProgress.id}`}
              className="bg-primary text-primary-foreground mt-2 inline-block rounded-md px-4 py-2 text-sm font-medium"
            >
              Continue Workout
            </Link>
          </div>
        </div>
      ) : planned ? (
        <div className="border-primary flex items-start gap-3 rounded-md border-l-4 p-4 shadow-sm">
          <div className="bg-primary/10 text-primary rounded-full p-2">
            <Dumbbell className="h-5 w-5" />
          </div>
          <div className="flex-1 space-y-1">
            <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
              Planned for today
            </p>
            <p className="text-lg font-semibold">
              {planned.label || "Workout"}
            </p>
            {sessionMeta && (
              <p className="text-muted-foreground text-sm">{sessionMeta}</p>
            )}
            <Link
              href={`/workouts/${planned.id}`}
              className="bg-primary text-primary-foreground mt-2 inline-block rounded-md px-4 py-2 text-sm font-medium"
            >
              View & Start
            </Link>
          </div>
        </div>
      ) : completed ? (
        <div className="flex items-start gap-3 rounded-md border-l-4 border-emerald-500 p-4 shadow-sm">
          <div className="rounded-full bg-emerald-500/10 p-2 text-emerald-600">
            <CheckCircle2 className="h-5 w-5" />
          </div>
          <div className="flex-1 space-y-1">
            <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
              Completed today
            </p>
            <p className="text-lg font-semibold">
              {completed.label || "Workout"}
            </p>
            {sessionMeta && (
              <p className="text-muted-foreground text-sm">{sessionMeta}</p>
            )}
            <div className="mt-2 flex gap-2">
              <Link
                href={`/workouts/${completed.id}`}
                className="border-input rounded-md border px-4 py-2 text-sm font-medium"
              >
                View Workout
              </Link>
              <form action={startAdHocWorkoutAction}>
                <button
                  type="submit"
                  className="border-input rounded-md border px-4 py-2 text-sm font-medium"
                >
                  Start Another
                </button>
              </form>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-4 rounded-md border border-dashed p-4">
          <div className="space-y-1">
            <p className="font-medium">No workout planned yet</p>
            {lastCompletedSession && (
              <p className="text-muted-foreground text-sm">
                Last workout:{" "}
                {lastCompletedSession.date.toLocaleDateString(undefined, {
                  weekday: "long",
                  timeZone: "UTC",
                })}{" "}
                — {lastCompletedSession.label || "Workout"}
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/generate"
              className="bg-primary text-primary-foreground flex items-center gap-1.5 rounded-md px-4 py-2 text-sm font-medium"
            >
              <Sparkles className="h-4 w-4" />
              Generate Workout
            </Link>
            {lastCompletedSession && (
              <Link
                href="/generate?tab=multi"
                className="border-input flex items-center gap-1.5 rounded-md border px-4 py-2 text-sm font-medium"
              >
                <Play className="h-4 w-4" />
                Repeat Last Week
              </Link>
            )}
            <form action={startAdHocWorkoutAction}>
              <button
                type="submit"
                className="border-input flex items-center gap-1.5 rounded-md border px-4 py-2 text-sm font-medium"
              >
                <Plus className="h-4 w-4" />
                Ad-hoc
              </button>
            </form>
          </div>
        </div>
      )}

      <div className="h-20" aria-hidden="true" />
      <BottomNav />
    </main>
  );
}
