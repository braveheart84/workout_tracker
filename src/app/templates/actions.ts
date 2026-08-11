"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { persistWorkoutStructure } from "@/lib/persist-workout-structure";
import {
  workoutSuggestionSchema,
  type WorkoutSuggestion,
  type SuggestedSet,
} from "@/lib/workout-suggestion-schema";
import type { SetType, Set as WorkoutSet } from "@/generated/prisma/client";

const nameSchema = z
  .string()
  .trim()
  .min(1, "Give the template a name.")
  .max(100, "Keep the name under 100 characters.");

// The most representative set for an exercise, in priority order: what the
// user actually logged (truest picture of "what this workout is," and the
// only source that ever has a weight), then what was targeted if nothing's
// been logged yet (a still-PLANNED session), then a schema-satisfying
// minimum as a last resort for a manually-added exercise with neither -
// mirrors the exercise's own default set type rather than inventing a type
// mismatch.
function representativeSet(workoutExercise: {
  targetReps: number | null;
  targetDurationSeconds: number | null;
  targetDistanceMeters: number | null;
  exercise: { defaultSetType: SetType };
  sets: WorkoutSet[];
}): SuggestedSet {
  const [loggedSet] = [...workoutExercise.sets].sort(
    (a, b) => a.roundNumber - b.roundNumber,
  );
  if (loggedSet) {
    return {
      setType: loggedSet.setType,
      reps: loggedSet.reps,
      durationSeconds: loggedSet.durationSeconds,
      distanceMeters: loggedSet.distanceMeters,
      weight: loggedSet.weight,
      weightUnit: loggedSet.weightUnit,
    };
  }
  if (workoutExercise.targetReps != null) {
    return {
      setType: "REPS",
      reps: workoutExercise.targetReps,
      durationSeconds: null,
      distanceMeters: null,
      weight: null,
      weightUnit: null,
    };
  }
  if (workoutExercise.targetDurationSeconds != null) {
    return {
      setType: "DURATION",
      reps: null,
      durationSeconds: workoutExercise.targetDurationSeconds,
      distanceMeters: null,
      weight: null,
      weightUnit: null,
    };
  }
  if (workoutExercise.targetDistanceMeters != null) {
    return {
      setType: "DISTANCE",
      reps: null,
      durationSeconds: null,
      distanceMeters: workoutExercise.targetDistanceMeters,
      weight: null,
      weightUnit: null,
    };
  }
  const fallbackType = workoutExercise.exercise.defaultSetType;
  return {
    setType: fallbackType,
    reps: fallbackType === "REPS" ? 1 : null,
    durationSeconds: fallbackType === "DURATION" ? 30 : null,
    distanceMeters: fallbackType === "DISTANCE" ? 100 : null,
    weight: null,
    weightUnit: null,
  };
}

export type SaveAsTemplateFormState =
  { error?: string; success?: boolean } | undefined;

// PRD 7.2: "from any accepted or completed session, the user can 'Save as
// Template' - a named, reusable structure (blocks, exercises, target sets,
// no date)." Snapshots into the same shape used for an AI suggestion so it
// can later be dropped straight into the generate flow's existing
// review/accept UI, or turned into an ad-hoc session, with no separate
// rendering path (see persistWorkoutStructure / startWorkoutFromTemplateAction).
export async function saveSessionAsTemplateAction(
  sessionId: string,
  _prevState: SaveAsTemplateFormState,
  formData: FormData,
): Promise<SaveAsTemplateFormState> {
  const session = await auth();
  if (!session?.user) {
    return { error: "You must be logged in." };
  }

  const parsedName = nameSchema.safeParse(formData.get("name"));
  if (!parsedName.success) {
    return {
      error: parsedName.error.issues[0]?.message ?? "Give the template a name.",
    };
  }

  const workoutSession = await prisma.workoutSession.findFirst({
    where: {
      id: sessionId,
      userId: session.user.id,
      status: { not: "DISCARDED" },
    },
    include: {
      blocks: {
        orderBy: { order: "asc" },
        include: {
          workoutExercises: {
            orderBy: { order: "asc" },
            include: { exercise: true, sets: true },
          },
        },
      },
    },
  });
  if (!workoutSession) {
    return { error: "Workout not found." };
  }
  if (workoutSession.blocks.every((b) => b.workoutExercises.length === 0)) {
    return { error: "Add at least one exercise before saving as a template." };
  }

  const structure: WorkoutSuggestion = {
    label: workoutSession.label,
    rationale: null,
    blocks: workoutSession.blocks
      .filter((block) => block.workoutExercises.length > 0)
      .map((block) => ({
        roundCount: block.roundCount,
        restSeconds: block.restSeconds,
        exercises: block.workoutExercises.map((we) => ({
          name: we.exercise.name,
          muscleGroup: we.exercise.muscleGroup,
          suggestedSet: representativeSet(we),
        })),
      })),
  };

  const parsedStructure = workoutSuggestionSchema.safeParse(structure);
  if (!parsedStructure.success) {
    return { error: "This workout can't be saved as a template right now." };
  }

  await prisma.workoutTemplate.create({
    data: {
      userId: session.user.id,
      name: parsedName.data,
      structure: parsedStructure.data,
      createdFromSessionId: sessionId,
    },
  });

  revalidatePath(`/workouts/${sessionId}`);
  revalidatePath("/templates");
  return { success: true };
}

// PRD 7.3: "the user can start an ad-hoc workout ... or from a saved
// template." Skips straight to an IN_PROGRESS session, same as
// startAdHocWorkoutAction, just pre-populated from the template's structure
// instead of empty.
export async function startWorkoutFromTemplateAction(templateId: string) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const template = await prisma.workoutTemplate.findFirst({
    where: { id: templateId, userId: session.user.id },
  });
  if (!template) {
    redirect("/templates");
  }

  const parsed = workoutSuggestionSchema.safeParse(template.structure);
  if (!parsed.success) {
    redirect("/templates");
  }

  const newSessionId = await persistWorkoutStructure(
    session.user.id,
    parsed.data,
    new Date(),
    { status: "IN_PROGRESS", source: "MANUAL", startedAt: new Date() },
  );

  redirect(`/workouts/${newSessionId}`);
}

export async function deleteTemplateAction(id: string) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  await prisma.workoutTemplate.deleteMany({
    where: { id, userId: session.user.id },
  });

  revalidatePath("/templates");
}
