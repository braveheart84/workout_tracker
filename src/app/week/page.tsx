import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { BottomNav } from "@/components/bottom-nav";
import { getUserTimezone, todayInTimezone } from "@/lib/user-date";
import { WeekStrip } from "./week-strip";

export default async function WeekPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const timezone = await getUserTimezone();
  const weekStart = todayInTimezone(timezone);
  const todayIso = weekStart.toISOString().slice(0, 10);
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
        <WeekStrip days={days} todayIso={todayIso} />
        <div className="h-20" aria-hidden="true" />
      </div>
      <BottomNav />
    </main>
  );
}
