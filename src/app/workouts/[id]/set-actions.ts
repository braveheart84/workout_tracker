"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import type { SetType } from "@/generated/prisma/client";

export type SetFormState = { error?: string; success?: boolean } | undefined;

const repsSchema = z.object({
  reps: z.coerce.number().int().min(1, "Enter a valid rep count.").max(1000),
});

const durationSchema = z.object({
  durationSeconds: z.coerce
    .number()
    .int()
    .min(1, "Enter a valid duration in seconds.")
    .max(36000),
});

const distanceSchema = z.object({
  distanceMeters: z.coerce
    .number()
    .positive("Enter a valid distance in meters.")
    .max(1000000),
});

function parseWeight(
  formData: FormData,
):
  | { weight: number | null; weightUnit: "KG" | "LB" | null }
  | { error: string } {
  const raw = formData.get("weight");
  if (typeof raw !== "string" || raw.trim() === "") {
    return { weight: null, weightUnit: null };
  }
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0 || n > 10000) {
    return { error: "Enter a valid weight." };
  }
  const unitRaw = formData.get("weightUnit");
  return { weight: n, weightUnit: unitRaw === "LB" ? "LB" : "KG" };
}

function parseSetFields(setType: SetType, formData: FormData) {
  const weightResult = parseWeight(formData);
  if ("error" in weightResult) {
    return { success: false as const, error: weightResult.error };
  }

  if (setType === "REPS") {
    const parsed = repsSchema.safeParse({ reps: formData.get("reps") });
    if (!parsed.success) {
      return {
        success: false as const,
        error: parsed.error.issues[0]?.message ?? "Invalid input.",
      };
    }
    return {
      success: true as const,
      data: {
        reps: parsed.data.reps,
        durationSeconds: null,
        distanceMeters: null,
        ...weightResult,
      },
    };
  }

  if (setType === "DURATION") {
    const parsed = durationSchema.safeParse({
      durationSeconds: formData.get("durationSeconds"),
    });
    if (!parsed.success) {
      return {
        success: false as const,
        error: parsed.error.issues[0]?.message ?? "Invalid input.",
      };
    }
    return {
      success: true as const,
      data: {
        reps: null,
        durationSeconds: parsed.data.durationSeconds,
        distanceMeters: null,
        ...weightResult,
      },
    };
  }

  const parsed = distanceSchema.safeParse({
    distanceMeters: formData.get("distanceMeters"),
  });
  if (!parsed.success) {
    return {
      success: false as const,
      error: parsed.error.issues[0]?.message ?? "Invalid input.",
    };
  }
  return {
    success: true as const,
    data: {
      reps: null,
      durationSeconds: null,
      distanceMeters: parsed.data.distanceMeters,
      ...weightResult,
    },
  };
}

export async function addSetAction(
  sessionId: string,
  workoutExerciseId: string,
  roundNumber: number,
  _prevState: SetFormState,
  formData: FormData,
): Promise<SetFormState> {
  const session = await auth();
  if (!session?.user) {
    return { error: "You must be logged in." };
  }

  const workoutExercise = await prisma.workoutExercise.findFirst({
    where: {
      id: workoutExerciseId,
      block: {
        session: {
          id: sessionId,
          userId: session.user.id,
          status: "IN_PROGRESS",
        },
      },
    },
    include: { exercise: true },
  });
  if (!workoutExercise) {
    return { error: "Exercise not found." };
  }

  const parsed = parseSetFields(
    workoutExercise.exercise.defaultSetType,
    formData,
  );
  if (!parsed.success) {
    return { error: parsed.error };
  }

  // Snapshot whatever this exercise's plan/template targeted for this
  // round, alongside what's actually being logged - null across the board
  // for a manually-added exercise, which never had a target to snapshot.
  await prisma.set.create({
    data: {
      workoutExerciseId,
      roundNumber,
      setType: workoutExercise.exercise.defaultSetType,
      ...parsed.data,
      suggestedReps: workoutExercise.targetReps,
      suggestedDurationSeconds: workoutExercise.targetDurationSeconds,
      suggestedDistanceMeters: workoutExercise.targetDistanceMeters,
      suggestedWeight: workoutExercise.targetWeight,
      suggestedWeightUnit: workoutExercise.targetWeightUnit,
    },
  });

  revalidatePath(`/workouts/${sessionId}`);
  return { success: true };
}

export async function updateSetAction(
  sessionId: string,
  setId: string,
  _prevState: SetFormState,
  formData: FormData,
): Promise<SetFormState> {
  const session = await auth();
  if (!session?.user) {
    return { error: "You must be logged in." };
  }

  const set = await prisma.set.findFirst({
    where: {
      id: setId,
      workoutExercise: {
        block: {
          session: {
            id: sessionId,
            userId: session.user.id,
            status: "IN_PROGRESS",
          },
        },
      },
    },
    select: { setType: true },
  });
  if (!set) {
    return { error: "Set not found." };
  }

  const parsed = parseSetFields(set.setType, formData);
  if (!parsed.success) {
    return { error: parsed.error };
  }

  await prisma.set.update({
    where: { id: setId },
    data: parsed.data,
  });

  revalidatePath(`/workouts/${sessionId}`);
  return { success: true };
}

export async function deleteSetAction(sessionId: string, setId: string) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  await prisma.set.deleteMany({
    where: {
      id: setId,
      workoutExercise: {
        block: {
          session: {
            id: sessionId,
            userId: session.user.id,
            status: "IN_PROGRESS",
          },
        },
      },
    },
  });

  revalidatePath(`/workouts/${sessionId}`);
}
