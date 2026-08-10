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

  const prompt = [
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
  { error?: string; suggestion?: WorkoutSuggestion } | undefined;

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

  const { historyLines, libraryLines } = await buildGenerationContext(
    session.user.id,
  );
  const { system, prompt } = buildPrompt(freeText, historyLines, libraryLines);

  try {
    const suggestion = await requestStructuredOutput({
      system,
      prompt,
      schema: workoutSuggestionSchema,
      toolDescription:
        "Return a single day's suggested workout structure matching the schema.",
    });
    return { suggestion };
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
) {
  return prisma.$transaction(async (tx) => {
    const workoutSession = await tx.workoutSession.create({
      data: {
        userId,
        date: new Date(),
        status: "PLANNED",
        type: "STRENGTH",
        label: suggestion.label,
        source: "AI_GENERATED",
      },
    });

    for (
      let blockIndex = 0;
      blockIndex < suggestion.blocks.length;
      blockIndex++
    ) {
      const block = suggestion.blocks[blockIndex];
      const workoutBlock = await tx.workoutBlock.create({
        data: {
          sessionId: workoutSession.id,
          order: blockIndex,
          roundCount: block.roundCount,
          restSeconds: block.restSeconds,
        },
      });

      for (
        let exerciseIndex = 0;
        exerciseIndex < block.exercises.length;
        exerciseIndex++
      ) {
        const exercise = block.exercises[exerciseIndex];
        const libraryExercise = await tx.exercise.upsert({
          where: { userId_name: { userId, name: exercise.name } },
          update: {},
          create: {
            userId,
            name: exercise.name,
            muscleGroup: exercise.muscleGroup,
            defaultSetType: exercise.suggestedSet.setType,
          },
        });

        await tx.workoutExercise.create({
          data: {
            blockId: workoutBlock.id,
            exerciseId: libraryExercise.id,
            order: exerciseIndex,
          },
        });
      }
    }

    return workoutSession.id;
  });
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

  const newSessionId = await persistWorkoutSuggestion(
    session.user.id,
    parsed.data,
  );

  redirect(`/workouts/${newSessionId}`);
}
