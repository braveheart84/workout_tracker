import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { DIFFICULTY_LABELS } from "@/lib/difficulty";

export default async function HistoryPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const sessions = await prisma.workoutSession.findMany({
    where: { userId: session.user.id, status: "COMPLETED" },
    orderBy: { completedAt: "desc" },
    take: 50,
    include: {
      blocks: {
        include: {
          workoutExercises: { include: { sets: { select: { id: true } } } },
        },
      },
    },
  });

  return (
    <main className="flex flex-1 flex-col items-center gap-6 p-8">
      <div className="w-full max-w-lg space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold tracking-tight">History</h1>
          <Link href="/dashboard" className="text-sm underline">
            Back to dashboard
          </Link>
        </div>

        {sessions.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            No completed workouts yet.
          </p>
        ) : (
          <ul className="space-y-3">
            {sessions.map((workoutSession) => {
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

              return (
                <li key={workoutSession.id}>
                  <Link
                    href={`/workouts/${workoutSession.id}`}
                    className="hover:bg-muted/30 block space-y-1 rounded-md border p-4 text-sm"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium">
                        {workoutSession.label || "Workout"}
                      </span>
                      <span className="text-muted-foreground text-xs">
                        {workoutSession.date.toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-muted-foreground text-xs">
                      {workoutSession.type === "STRENGTH" ? "Strength" : "Run"}
                      {" · "}
                      {exerciseCount} exercise{exerciseCount === 1 ? "" : "s"}
                      {" · "}
                      {setCount} set{setCount === 1 ? "" : "s"}
                      {workoutSession.difficultyRating != null &&
                        ` · Difficulty: ${workoutSession.difficultyRating}/5 (${DIFFICULTY_LABELS[workoutSession.difficultyRating - 1]})`}
                    </p>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </main>
  );
}
