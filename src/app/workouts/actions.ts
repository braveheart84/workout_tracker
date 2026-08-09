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

export async function finishWorkoutSessionAction(id: string) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  await prisma.workoutSession.updateMany({
    where: { id, userId: session.user.id, status: "IN_PROGRESS" },
    data: { status: "COMPLETED", completedAt: new Date() },
  });

  revalidatePath(`/workouts/${id}`);
}
