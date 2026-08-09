"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";

const exerciseSchema = z.object({
  name: z.string().trim().min(1, "Name is required.").max(100),
  muscleGroup: z
    .string()
    .max(100)
    .transform((v) => (v.trim() === "" ? null : v.trim())),
  defaultSetType: z.enum(["REPS", "DURATION", "DISTANCE"]),
});

export type ExerciseFormState =
  { error?: string; success?: boolean } | undefined;

function isUniqueConstraintError(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

function parseExerciseForm(formData: FormData) {
  return exerciseSchema.safeParse({
    name: formData.get("name"),
    muscleGroup: formData.get("muscleGroup"),
    defaultSetType: formData.get("defaultSetType"),
  });
}

export async function createExerciseAction(
  _prevState: ExerciseFormState,
  formData: FormData,
): Promise<ExerciseFormState> {
  const session = await auth();
  if (!session?.user) {
    return { error: "You must be logged in." };
  }

  const parsed = parseExerciseForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  try {
    await prisma.exercise.create({
      data: { ...parsed.data, userId: session.user.id },
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return { error: "You already have an exercise with this name." };
    }
    throw error;
  }

  revalidatePath("/exercises");
  return { success: true };
}

export async function updateExerciseAction(
  id: string,
  _prevState: ExerciseFormState,
  formData: FormData,
): Promise<ExerciseFormState> {
  const session = await auth();
  if (!session?.user) {
    return { error: "You must be logged in." };
  }

  const parsed = parseExerciseForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  try {
    const result = await prisma.exercise.updateMany({
      where: { id, userId: session.user.id },
      data: parsed.data,
    });
    if (result.count === 0) {
      return { error: "Exercise not found." };
    }
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return { error: "You already have an exercise with this name." };
    }
    throw error;
  }

  revalidatePath("/exercises");
  return { success: true };
}

export async function deleteExerciseAction(id: string) {
  const session = await auth();
  if (!session?.user) return;

  await prisma.exercise.deleteMany({
    where: { id, userId: session.user.id },
  });

  revalidatePath("/exercises");
}
