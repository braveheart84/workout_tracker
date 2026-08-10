"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function startAdHocWorkoutAction() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const workoutSession = await prisma.workoutSession.create({
    data: {
      userId: session.user.id,
      date: new Date(),
      status: "IN_PROGRESS",
      startedAt: new Date(),
    },
  });

  redirect(`/workouts/${workoutSession.id}`);
}

export async function startPlannedWorkoutAction(id: string) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  await prisma.workoutSession.updateMany({
    where: { id, userId: session.user.id, status: "PLANNED" },
    data: { status: "IN_PROGRESS", startedAt: new Date() },
  });

  revalidatePath(`/workouts/${id}`);
}

const sessionUpdateSchema = z.object({
  label: z
    .string()
    .max(100)
    .transform((v) => (v.trim() === "" ? null : v.trim())),
  warmupNotes: z
    .string()
    .max(2000)
    .transform((v) => (v.trim() === "" ? null : v.trim())),
  finisherNotes: z
    .string()
    .max(2000)
    .transform((v) => (v.trim() === "" ? null : v.trim())),
  cooldownNotes: z
    .string()
    .max(2000)
    .transform((v) => (v.trim() === "" ? null : v.trim())),
});

export type WorkoutSessionFormState =
  { error?: string; success?: boolean } | undefined;

export async function updateWorkoutSessionAction(
  id: string,
  _prevState: WorkoutSessionFormState,
  formData: FormData,
): Promise<WorkoutSessionFormState> {
  const session = await auth();
  if (!session?.user) {
    return { error: "You must be logged in." };
  }

  const parsed = sessionUpdateSchema.safeParse({
    label: formData.get("label"),
    warmupNotes: formData.get("warmupNotes"),
    finisherNotes: formData.get("finisherNotes"),
    cooldownNotes: formData.get("cooldownNotes"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const result = await prisma.workoutSession.updateMany({
    where: { id, userId: session.user.id, status: "IN_PROGRESS" },
    data: parsed.data,
  });

  if (result.count === 0) {
    return { error: "Workout not found or no longer editable." };
  }

  revalidatePath(`/workouts/${id}`);
  return { success: true };
}

function optionalRating(min: number, max: number, label: string) {
  return z.preprocess(
    (v) => (v === null || v === "" ? null : v),
    z
      .string()
      .transform((v) => Number(v))
      .refine(
        (v) => Number.isInteger(v) && v >= min && v <= max,
        `${label} must be between ${min} and ${max}.`,
      )
      .nullable(),
  );
}

const optionalNote = (max: number) =>
  z
    .string()
    .max(max)
    .transform((v) => (v.trim() === "" ? null : v.trim()));

const feedbackSchema = z.object({
  difficultyRating: optionalRating(1, 5, "Difficulty rating"),
  difficultyNote: optionalNote(1000),
  energyRating: optionalRating(1, 10, "Energy rating"),
  goalForNext: optionalNote(1000),
});

export type FinishWorkoutFormState =
  { error?: string; success?: boolean } | undefined;

export async function finishWorkoutSessionAction(
  id: string,
  _prevState: FinishWorkoutFormState,
  formData: FormData,
): Promise<FinishWorkoutFormState> {
  const session = await auth();
  if (!session?.user) {
    return { error: "You must be logged in." };
  }

  const parsed = feedbackSchema.safeParse({
    difficultyRating: formData.get("difficultyRating"),
    difficultyNote: formData.get("difficultyNote"),
    energyRating: formData.get("energyRating"),
    goalForNext: formData.get("goalForNext"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const result = await prisma.workoutSession.updateMany({
    where: { id, userId: session.user.id, status: "IN_PROGRESS" },
    data: {
      status: "COMPLETED",
      completedAt: new Date(),
      ...parsed.data,
    },
  });
  if (result.count === 0) {
    return { error: "Workout not found or already finished." };
  }

  revalidatePath(`/workouts/${id}`);
  return { success: true };
}
