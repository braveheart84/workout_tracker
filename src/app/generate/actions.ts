"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { requestStructuredOutput } from "@/lib/claude";
import {
  workoutSuggestionSchema,
  type WorkoutSuggestion,
} from "@/lib/workout-suggestion-schema";

const freeTextSchema = z.string().max(1000);

// Matches PRD 7.2's generation horizon (a range request asks for 1-7 days) -
// a single-day suggestion can target any day from today through 6 days out.
const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a valid date.")
  .transform((v) => new Date(`${v}T00:00:00.000Z`))
  .refine((d) => !Number.isNaN(d.getTime()), "Pick a valid date.")
  .refine((d) => {
    const now = new Date();
    const todayUtc = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
    );
    const maxUtc = new Date(todayUtc);
    maxUtc.setUTCDate(maxUtc.getUTCDate() + 6);
    return d >= todayUtc && d <= maxUtc;
  }, "Pick a date within the next 7 days.");

async function buildGenerationContext(userId: string) {
  const fourteenDaysAgo = new Date();
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

  const [recentSessions, exercises] = await Promise.all([
    prisma.workoutSession.findMany({
      where: { userId, status: "COMPLETED", date: { gte: fourteenDaysAgo } },
      orderBy: { date: "desc" },
      include: {
        blocks: {
          include: { workoutExercises: { include: { exercise: true } } },
        },
      },
    }),
    prisma.exercise.findMany({ where: { userId }, orderBy: { name: "asc" } }),
  ]);

  const historyLines = recentSessions.map((workoutSession) => {
    const muscleGroups = Array.from(
      new Set(
        workoutSession.blocks
          .flatMap((block) =>
            block.workoutExercises.map((we) => we.exercise.muscleGroup),
          )
          .filter((muscleGroup): muscleGroup is string => Boolean(muscleGroup)),
      ),
    );
    const parts = [
      workoutSession.date.toISOString().slice(0, 10),
      workoutSession.type,
      workoutSession.label ?? undefined,
      muscleGroups.length > 0
        ? `muscle groups: ${muscleGroups.join(", ")}`
        : undefined,
      workoutSession.difficultyRating != null
        ? `difficulty: ${workoutSession.difficultyRating}/5`
        : undefined,
    ].filter(Boolean);
    return `- ${parts.join(" | ")}`;
  });

  const libraryLines = exercises.map(
    (exercise) =>
      `- ${exercise.name} (${exercise.defaultSetType.toLowerCase()}${
        exercise.muscleGroup ? `, ${exercise.muscleGroup}` : ""
      })`,
  );

  return { historyLines, libraryLines };
}

function buildPrompt(
  freeText: string,
  targetDate: Date,
  historyLines: string[],
  libraryLines: string[],
) {
  const system = [
    "You are a fitness coaching assistant inside a workout tracking app.",
    "Generate a single day's workout as a structured suggestion matching the provided tool schema.",
    "Prefer reusing the user's existing exercise names from their library when a suitable match exists, rather than inventing near-duplicate names.",
    "Keep the workout realistic in scope: 1-6 blocks, each with 1-5 exercises, sensible round counts (1-5), and sensible rest periods.",
    "Avoid heavily repeating muscle groups the user trained in the last 1-2 days, if that history is available.",
  ].join(" ");

  const targetDateLabel = targetDate.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });

  const prompt = [
    `This workout is for: ${targetDateLabel}.`,
    "",
    freeText.trim()
      ? `User's request: ${freeText.trim()}`
      : "User's request: (none given - use their recent history to suggest something sensible)",
    "",
    historyLines.length > 0
      ? `Recent workout history (last 14 days, most recent first):\n${historyLines.join("\n")}`
      : "Recent workout history: none available.",
    "",
    libraryLines.length > 0
      ? `User's existing exercise library:\n${libraryLines.join("\n")}`
      : "User's existing exercise library: empty.",
  ].join("\n");

  return { system, prompt };
}

export type GenerateFormState =
  { error?: string; suggestion?: WorkoutSuggestion; date?: string } | undefined;

export async function generateWorkoutSuggestionAction(
  _prevState: GenerateFormState,
  formData: FormData,
): Promise<GenerateFormState> {
  const session = await auth();
  if (!session?.user) {
    return { error: "You must be logged in." };
  }

  const parsedFreeText = freeTextSchema.safeParse(
    formData.get("freeText") ?? "",
  );
  const freeText = parsedFreeText.success ? parsedFreeText.data : "";

  const dateInput = formData.get("date");
  const parsedDate = dateSchema.safeParse(dateInput);
  if (!parsedDate.success) {
    return {
      error: parsedDate.error.issues[0]?.message ?? "Pick a valid date.",
    };
  }
  const targetDate = parsedDate.data;
  const dateIso = targetDate.toISOString().slice(0, 10);

  const { historyLines, libraryLines } = await buildGenerationContext(
    session.user.id,
  );
  const { system, prompt } = buildPrompt(
    freeText,
    targetDate,
    historyLines,
    libraryLines,
  );

  try {
    const suggestion = await requestStructuredOutput({
      system,
      prompt,
      schema: workoutSuggestionSchema,
      toolDescription:
        "Return a single day's suggested workout structure matching the schema.",
    });
    return { suggestion, date: dateIso };
  } catch (error) {
    // PRD Section 8: any generation failure - a transient Claude API issue,
    // a malformed response, or a server misconfiguration alike - degrades
    // gracefully to a retryable error instead of crashing the page. Logged
    // here so a real misconfiguration is still visible in server logs.
    console.error("Workout generation failed:", error);
    return {
      error:
        "Couldn't generate a workout right now. Try again, or start one manually.",
    };
  }
}

// Framework-agnostic: creates the WorkoutSession/WorkoutBlock/WorkoutExercise
// rows for an accepted suggestion and returns the new session id. Kept
// separate from acceptWorkoutSuggestionAction (which handles auth, FormData,
// and the redirect) so the persistence logic can be exercised directly.
export async function persistWorkoutSuggestion(
  userId: string,
  suggestion: WorkoutSuggestion,
  date: Date,
) {
  // Resolve/create every referenced exercise up front, outside the
  // transaction and in parallel. Previously this looped one upsert + one
  // WorkoutExercise create per exercise *inside* the transaction, so a
  // larger suggestion (multiple blocks, several exercises each) meant many
  // sequential round trips - easily enough to blow past Prisma's 5s
  // interactive-transaction timeout (P2028) under normal network latency.
  // Doing it here means an upsert can't be rolled back by a later failure
  // in the transaction, but a stray unused library exercise is harmless -
  // it just gets reused if the same generation is retried.
  const exercisesByName = new Map(
    suggestion.blocks
      .flatMap((block) => block.exercises)
      .map((exercise) => [exercise.name, exercise]),
  );
  const resolvedExercises = await Promise.all(
    Array.from(exercisesByName.values()).map((exercise) =>
      prisma.exercise.upsert({
        where: { userId_name: { userId, name: exercise.name } },
        update: {},
        create: {
          userId,
          name: exercise.name,
          muscleGroup: exercise.muscleGroup,
          defaultSetType: exercise.suggestedSet.setType,
        },
      }),
    ),
  );
  const exerciseIdByName = new Map(
    resolvedExercises.map((exercise) => [exercise.name, exercise.id]),
  );

  return prisma.$transaction(
    async (tx) => {
      const workoutSession = await tx.workoutSession.create({
        data: {
          userId,
          date,
          status: "PLANNED",
          type: "STRENGTH",
          label: suggestion.label,
          source: "AI_GENERATED",
        },
      });

      // Batched instead of one create per block/exercise - the transaction
      // now does a fixed 3 round trips regardless of suggestion size.
      const createdBlocks = await tx.workoutBlock.createManyAndReturn({
        data: suggestion.blocks.map((block, blockIndex) => ({
          sessionId: workoutSession.id,
          order: blockIndex,
          roundCount: block.roundCount,
          restSeconds: block.restSeconds,
        })),
      });
      const blockIdByOrder = new Map(
        createdBlocks.map((block) => [block.order, block.id]),
      );

      await tx.workoutExercise.createMany({
        data: suggestion.blocks.flatMap((block, blockIndex) =>
          block.exercises.map((exercise, exerciseIndex) => ({
            blockId: blockIdByOrder.get(blockIndex)!,
            exerciseId: exerciseIdByName.get(exercise.name)!,
            order: exerciseIndex,
          })),
        ),
      });

      return workoutSession.id;
    },
    { timeout: 15000 },
  );
}

export type AcceptFormState = { error?: string } | undefined;

export async function acceptWorkoutSuggestionAction(
  _prevState: AcceptFormState,
  formData: FormData,
): Promise<AcceptFormState> {
  const session = await auth();
  if (!session?.user) {
    return { error: "You must be logged in." };
  }

  const raw = formData.get("suggestion");
  if (typeof raw !== "string") {
    return { error: "Missing suggestion data." };
  }

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return { error: "Invalid suggestion data." };
  }

  const parsed = workoutSuggestionSchema.safeParse(json);
  if (!parsed.success) {
    return { error: "Invalid suggestion data." };
  }

  const parsedDate = dateSchema.safeParse(formData.get("date"));
  if (!parsedDate.success) {
    return {
      error: parsedDate.error.issues[0]?.message ?? "Pick a valid date.",
    };
  }

  const newSessionId = await persistWorkoutSuggestion(
    session.user.id,
    parsed.data,
    parsedDate.data,
  );

  redirect(`/workouts/${newSessionId}`);
}
