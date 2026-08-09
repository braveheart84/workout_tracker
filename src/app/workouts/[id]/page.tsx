import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import type { WorkoutSession } from "@/generated/prisma/client";
import { finishWorkoutSessionAction } from "../actions";
import { SessionForm } from "./session-form";
import { BlocksManager } from "./blocks-manager";

const STATUS_LABELS: Record<WorkoutSession["status"], string> = {
  PLANNED: "Planned",
  IN_PROGRESS: "In progress",
  COMPLETED: "Completed",
  DISCARDED: "Discarded",
};

export default async function WorkoutSessionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const workoutSession = await prisma.workoutSession.findFirst({
    where: { id, userId: session.user.id },
  });

  if (!workoutSession) {
    notFound();
  }

  const [blocks, exercises] = await Promise.all([
    prisma.workoutBlock.findMany({
      where: { sessionId: id },
      orderBy: { order: "asc" },
      include: {
        workoutExercises: {
          orderBy: { order: "asc" },
          include: { exercise: true },
        },
      },
    }),
    prisma.exercise.findMany({
      where: { userId: session.user.id },
      orderBy: { name: "asc" },
    }),
  ]);

  const isInProgress = workoutSession.status === "IN_PROGRESS";

  return (
    <main className="flex flex-1 flex-col items-center gap-6 p-8">
      <div className="w-full max-w-lg space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold tracking-tight">
            {workoutSession.label || "Workout"}
          </h1>
          <Link href="/dashboard" className="text-sm underline">
            Back to dashboard
          </Link>
        </div>

        <p className="text-muted-foreground text-sm">
          {workoutSession.date.toLocaleDateString()} ·{" "}
          {STATUS_LABELS[workoutSession.status]}
        </p>

        <SessionForm workoutSession={workoutSession} disabled={!isInProgress} />

        <BlocksManager
          sessionId={id}
          blocks={blocks}
          exercises={exercises}
          disabled={!isInProgress}
        />

        {isInProgress ? (
          <form
            action={finishWorkoutSessionAction.bind(null, workoutSession.id)}
          >
            <button
              type="submit"
              className="bg-primary text-primary-foreground w-full rounded-md px-3 py-2 text-sm font-medium"
            >
              Finish Workout
            </button>
          </form>
        ) : (
          <p className="text-muted-foreground text-sm">
            This workout is {STATUS_LABELS[workoutSession.status].toLowerCase()}
            .
          </p>
        )}
      </div>
    </main>
  );
}
