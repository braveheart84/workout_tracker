import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import type { WorkoutSession } from "@/generated/prisma/client";
import { getUserTimezone, todayInTimezone } from "@/lib/user-date";
import { SessionForm } from "./session-form";
import { BlocksManager } from "./blocks-manager";
import { FinishWorkoutForm } from "./finish-workout-form";
import { FeedbackSummary } from "./feedback-summary";
import { StartWorkoutButton } from "./start-workout-button";
import { DiscardPlannedWorkoutButton } from "./discard-planned-workout-button";
import { RescheduleWorkoutForm } from "./reschedule-workout-form";
import { SaveAsTemplateForm } from "./save-as-template-form";

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

  const [blocks, exercises, user] = await Promise.all([
    prisma.workoutBlock.findMany({
      where: { sessionId: id },
      orderBy: { order: "asc" },
      include: {
        workoutExercises: {
          orderBy: { order: "asc" },
          include: { exercise: true, sets: true },
        },
      },
    }),
    prisma.exercise.findMany({
      where: { userId: session.user.id },
      orderBy: { name: "asc" },
    }),
    prisma.user.findUniqueOrThrow({
      where: { id: session.user.id },
      select: { unitSystem: true },
    }),
  ]);

  const defaultWeightUnit = user.unitSystem === "IMPERIAL" ? "LB" : "KG";
  const isInProgress = workoutSession.status === "IN_PROGRESS";
  const isPlanned = workoutSession.status === "PLANNED";
  const timezone = await getUserTimezone();
  const todayIso = todayInTimezone(timezone).toISOString().slice(0, 10);

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
          defaultWeightUnit={defaultWeightUnit}
          disabled={!isInProgress}
        />

        {isInProgress ? (
          <FinishWorkoutForm sessionId={workoutSession.id} />
        ) : isPlanned ? (
          <div className="space-y-2">
            <StartWorkoutButton sessionId={workoutSession.id} />
            <RescheduleWorkoutForm
              sessionId={workoutSession.id}
              currentDateIso={workoutSession.date.toISOString().slice(0, 10)}
              todayIso={todayIso}
            />
            <DiscardPlannedWorkoutButton sessionId={workoutSession.id} />
          </div>
        ) : (
          <>
            <FeedbackSummary
              difficultyRating={workoutSession.difficultyRating}
              difficultyNote={workoutSession.difficultyNote}
              energyRating={workoutSession.energyRating}
              goalForNext={workoutSession.goalForNext}
            />
            <p className="text-muted-foreground text-sm">
              This workout is{" "}
              {STATUS_LABELS[workoutSession.status].toLowerCase()}.
            </p>
          </>
        )}

        {workoutSession.status !== "DISCARDED" && (
          <SaveAsTemplateForm sessionId={workoutSession.id} />
        )}
      </div>
    </main>
  );
}
