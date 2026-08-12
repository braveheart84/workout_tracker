import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { BottomNav } from "@/components/bottom-nav";
import { HistoryCalendar, type DaySession } from "./history-calendar";

export default async function HistoryPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const now = new Date();
  const todayUtc = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  const todayIso = todayUtc.toISOString().slice(0, 10);

  // A bounded but generous window (a year back, a few months forward for
  // rescheduled/planned days) rather than every session ever, so month
  // navigation stays a client-side filter with no refetch per month.
  const rangeStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 11, 1),
  );
  const rangeEnd = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 3, 1),
  );

  const sessions = await prisma.workoutSession.findMany({
    where: {
      userId: session.user.id,
      date: { gte: rangeStart, lt: rangeEnd },
    },
    orderBy: { date: "asc" },
    include: {
      blocks: {
        include: {
          workoutExercises: { include: { sets: { select: { id: true } } } },
        },
      },
    },
  });

  const sessionsByDate: Record<string, DaySession[]> = {};
  for (const workoutSession of sessions) {
    const dateIso = workoutSession.date.toISOString().slice(0, 10);
    const exerciseCount = workoutSession.blocks.reduce(
      (sum, block) => sum + block.workoutExercises.length,
      0,
    );
    const setCount = workoutSession.blocks.reduce(
      (sum, block) =>
        sum +
        block.workoutExercises.reduce(
          (blockSum, we) => blockSum + we.sets.length,
          0,
        ),
      0,
    );
    (sessionsByDate[dateIso] ??= []).push({
      id: workoutSession.id,
      status: workoutSession.status,
      label: workoutSession.label,
      type: workoutSession.type,
      exerciseCount,
      setCount,
      difficultyRating: workoutSession.difficultyRating,
    });
  }

  const minMonthKey = `${rangeStart.getUTCFullYear()}-${String(rangeStart.getUTCMonth() + 1).padStart(2, "0")}`;
  const maxMonthKey = `${new Date(rangeEnd.getTime() - 1).getUTCFullYear()}-${String(new Date(rangeEnd.getTime() - 1).getUTCMonth() + 1).padStart(2, "0")}`;

  return (
    <main className="flex flex-1 flex-col items-center gap-6 p-8">
      <div className="w-full max-w-lg space-y-6">
        <h1 className="text-2xl font-semibold tracking-tight">History</h1>
        <HistoryCalendar
          sessionsByDate={sessionsByDate}
          todayIso={todayIso}
          minMonthKey={minMonthKey}
          maxMonthKey={maxMonthKey}
        />
        <div className="h-20" aria-hidden="true" />
      </div>
      <BottomNav />
    </main>
  );
}
