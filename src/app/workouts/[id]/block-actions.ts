"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function addBlockAction(sessionId: string) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const owns = await prisma.workoutSession.findFirst({
    where: { id: sessionId, userId: session.user.id, status: "IN_PROGRESS" },
    select: { id: true },
  });
  if (!owns) return;

  const count = await prisma.workoutBlock.count({ where: { sessionId } });
  await prisma.workoutBlock.create({ data: { sessionId, order: count } });

  revalidatePath(`/workouts/${sessionId}`);
}

const blockUpdateSchema = z.object({
  roundCount: z.coerce
    .number()
    .int()
    .min(1, "At least 1 round.")
    .max(50, "Max 50 rounds."),
  restSeconds: z.string().transform((v) => {
    if (v.trim() === "") return null;
    const n = Number(v);
    return Number.isFinite(n) ? Math.max(0, Math.round(n)) : null;
  }),
});

export type BlockFormState = { error?: string; success?: boolean } | undefined;

export async function updateBlockAction(
  sessionId: string,
  blockId: string,
  _prevState: BlockFormState,
  formData: FormData,
): Promise<BlockFormState> {
  const session = await auth();
  if (!session?.user) {
    return { error: "You must be logged in." };
  }

  const parsed = blockUpdateSchema.safeParse({
    roundCount: formData.get("roundCount"),
    restSeconds: formData.get("restSeconds"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const result = await prisma.workoutBlock.updateMany({
    where: {
      id: blockId,
      session: {
        id: sessionId,
        userId: session.user.id,
        status: "IN_PROGRESS",
      },
    },
    data: parsed.data,
  });
  if (result.count === 0) {
    return { error: "Block not found or no longer editable." };
  }

  revalidatePath(`/workouts/${sessionId}`);
  return { success: true };
}

export async function deleteBlockAction(sessionId: string, blockId: string) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  await prisma.workoutBlock.deleteMany({
    where: {
      id: blockId,
      session: {
        id: sessionId,
        userId: session.user.id,
        status: "IN_PROGRESS",
      },
    },
  });

  revalidatePath(`/workouts/${sessionId}`);
}

export async function moveBlockAction(
  sessionId: string,
  blockId: string,
  direction: "up" | "down",
) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const blocks = await prisma.workoutBlock.findMany({
    where: {
      sessionId,
      session: { userId: session.user.id, status: "IN_PROGRESS" },
    },
    orderBy: { order: "asc" },
    select: { id: true, order: true },
  });

  const index = blocks.findIndex((b) => b.id === blockId);
  const swapIndex = direction === "up" ? index - 1 : index + 1;
  if (index === -1 || swapIndex < 0 || swapIndex >= blocks.length) return;

  const a = blocks[index];
  const b = blocks[swapIndex];

  await prisma.$transaction([
    prisma.workoutBlock.update({
      where: { id: a.id },
      data: { order: b.order },
    }),
    prisma.workoutBlock.update({
      where: { id: b.id },
      data: { order: a.order },
    }),
  ]);

  revalidatePath(`/workouts/${sessionId}`);
}

const noteSchema = z.object({
  noteForNextTime: z
    .string()
    .max(500)
    .transform((v) => (v.trim() === "" ? null : v.trim())),
});

export type NoteFormState = { error?: string; success?: boolean } | undefined;

export async function updateExerciseNoteAction(
  sessionId: string,
  workoutExerciseId: string,
  _prevState: NoteFormState,
  formData: FormData,
): Promise<NoteFormState> {
  const session = await auth();
  if (!session?.user) {
    return { error: "You must be logged in." };
  }

  const parsed = noteSchema.safeParse({
    noteForNextTime: formData.get("noteForNextTime"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const result = await prisma.workoutExercise.updateMany({
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
    data: parsed.data,
  });
  if (result.count === 0) {
    return { error: "Exercise not found." };
  }

  revalidatePath(`/workouts/${sessionId}`);
  return { success: true };
}

const addExerciseSchema = z.object({
  exerciseId: z.string().min(1, "Select an exercise."),
});

export type AddExerciseState =
  { error?: string; success?: boolean } | undefined;

export async function addExerciseToBlockAction(
  sessionId: string,
  blockId: string,
  _prevState: AddExerciseState,
  formData: FormData,
): Promise<AddExerciseState> {
  const session = await auth();
  if (!session?.user) {
    return { error: "You must be logged in." };
  }

  const parsed = addExerciseSchema.safeParse({
    exerciseId: formData.get("exerciseId"),
  });
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Select an exercise.",
    };
  }

  const block = await prisma.workoutBlock.findFirst({
    where: {
      id: blockId,
      session: {
        id: sessionId,
        userId: session.user.id,
        status: "IN_PROGRESS",
      },
    },
    select: { id: true },
  });
  if (!block) {
    return { error: "Block not found." };
  }

  const exercise = await prisma.exercise.findFirst({
    where: { id: parsed.data.exerciseId, userId: session.user.id },
    select: { id: true },
  });
  if (!exercise) {
    return { error: "Exercise not found." };
  }

  const count = await prisma.workoutExercise.count({ where: { blockId } });
  await prisma.workoutExercise.create({
    data: { blockId, exerciseId: exercise.id, order: count },
  });

  revalidatePath(`/workouts/${sessionId}`);
  return { success: true };
}

export async function removeExerciseFromBlockAction(
  sessionId: string,
  workoutExerciseId: string,
) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  await prisma.workoutExercise.deleteMany({
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
  });

  revalidatePath(`/workouts/${sessionId}`);
}

export async function moveExerciseAction(
  sessionId: string,
  blockId: string,
  workoutExerciseId: string,
  direction: "up" | "down",
) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const items = await prisma.workoutExercise.findMany({
    where: {
      blockId,
      block: {
        session: {
          id: sessionId,
          userId: session.user.id,
          status: "IN_PROGRESS",
        },
      },
    },
    orderBy: { order: "asc" },
    select: { id: true, order: true },
  });

  const index = items.findIndex((it) => it.id === workoutExerciseId);
  const swapIndex = direction === "up" ? index - 1 : index + 1;
  if (index === -1 || swapIndex < 0 || swapIndex >= items.length) return;

  const a = items[index];
  const b = items[swapIndex];

  await prisma.$transaction([
    prisma.workoutExercise.update({
      where: { id: a.id },
      data: { order: b.order },
    }),
    prisma.workoutExercise.update({
      where: { id: b.id },
      data: { order: a.order },
    }),
  ]);

  revalidatePath(`/workouts/${sessionId}`);
}
