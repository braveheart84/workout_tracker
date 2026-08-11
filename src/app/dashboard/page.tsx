import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { startAdHocWorkoutAction } from "@/app/workouts/actions";
import { BottomNav } from "@/components/bottom-nav";
import { SkippedDayBanner } from "./skipped-day-banner";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const now = new Date();
  const todayStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  const tomorrowStart = new Date(todayStart);
  tomorrowStart.setUTCDate(tomorrowStart.getUTCDate() + 1);

  const [todaysSessions, skippedSessions] = await Promise.all([
    prisma.workoutSession.findMany({
      where: {
        userId: session.user.id,
        date: { gte: todayStart, lt: tomorrowStart },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.workoutSession.findMany({
      where: {
        userId: session.user.id,
        status: "PLANNED",
        date: { lt: todayStart },
      },
      orderBy: { date: "asc" },
    }),
  ]);

  const inProgress = todaysSessions.find((s) => s.status === "IN_PROGRESS");
  const planned = todaysSessions.find((s) => s.status === "PLANNED");
  const completed = todaysSessions.find((s) => s.status === "COMPLETED");
  const todayIso = todayStart.toISOString().slice(0, 10);

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">Today</h1>
      <p className="text-muted-foreground">Logged in as {session.user.email}</p>

      <SkippedDayBanner sessions={skippedSessions} todayIso={todayIso} />

      {inProgress ? (
        <div className="space-y-2">
          <p className="text-sm">You have a workout in progress.</p>
          <Link
            href={`/workouts/${inProgress.id}`}
            className="bg-primary text-primary-foreground inline-block rounded-md px-4 py-2 text-sm font-medium"
          >
            Continue Workout
          </Link>
        </div>
      ) : planned ? (
        <div className="space-y-2">
          <p className="text-sm">You have a planned workout for today.</p>
          <Link
            href={`/workouts/${planned.id}`}
            className="bg-primary text-primary-foreground inline-block rounded-md px-4 py-2 text-sm font-medium"
          >
            View & Start
          </Link>
        </div>
      ) : completed ? (
        <div className="space-y-2">
          <p className="text-sm">Nice work — you completed a workout today.</p>
          <Link
            href={`/workouts/${completed.id}`}
            className="text-sm underline"
          >
            View workout
          </Link>
          <form action={startAdHocWorkoutAction}>
            <button
              type="submit"
              className="border-input rounded-md border px-4 py-2 text-sm font-medium"
            >
              Start another workout
            </button>
          </form>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-muted-foreground text-sm">No workout yet today.</p>
          <div className="flex justify-center gap-2">
            <Link
              href="/generate"
              className="bg-primary text-primary-foreground rounded-md px-4 py-2 text-sm font-medium"
            >
              Generate Workout
            </Link>
            <form action={startAdHocWorkoutAction}>
              <button
                type="submit"
                className="border-input rounded-md border px-4 py-2 text-sm font-medium"
              >
                Start ad-hoc workout
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
