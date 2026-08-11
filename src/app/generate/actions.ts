"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { requestStructuredOutput } from "@/lib/claude";
import {
  workoutSuggestionSchema,
  multiDaySuggestionSchema,
  type WorkoutSuggestion,
} from "@/lib/workout-suggestion-schema";

const freeTextSchema = z.string().max(1000);
const feedbackSchema = z
  .string()
  .trim()
  .min(1, "Describe what you'd like to change.")
  .max(1000);

// Matches PRD 7.2's generation horizon (a range request asks for 1-7 days) -
// today through 6 days out, shared by both the single-day date field and
// the multi-day dates array below.
function getGenerationWindow() {
  const now = new Date();
  const todayUtc = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  const maxUtc = new Date(todayUtc);
  maxUtc.setUTCDate(maxUtc.getUTCDate() + 6);
  return { todayUtc, maxUtc };
}

const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a valid date.")
  .transform((v) => new Date(`${v}T00:00:00.000Z`))
  .refine((d) => !Number.isNaN(d.getTime()), "Pick a valid date.")
  .refine((d) => {
    const { todayUtc, maxUtc } = getGenerationWindow();
    return d >= todayUtc && d <= maxUtc;
  }, "Pick a date within the next 7 days.");

// PRD 7.2's "range of days" scope, refined per user feedback after PR-16's
// first cut: rather than a single day count implying N *consecutive* days,
// the user picks which specific day(s) within the next week to generate
// for - either by count (auto-spaced with rest days between, see
// SPACED_OFFSETS_BY_COUNT client-side) or by checking exact days on a
// calendar. Either way, the client resolves that down to a concrete list of
// ISO dates and this is what actually gets validated server-side.
const datesArraySchema = z
  .array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick valid days."))
  .min(1, "Pick at least 1 day.")
  .max(7, "Pick at most 7 days.")
  .refine((arr) => new Set(arr).size === arr.length, "Duplicate day selected.")
  .transform((arr) =>
    arr
      .map((v) => new Date(`${v}T00:00:00.000Z`))
      .sort((a, b) => a.getTime() - b.getTime()),
  )
  .refine(
    (dates) => dates.every((d) => !Number.isNaN(d.getTime())),
    "Pick valid days.",
  )
  .refine((dates) => {
    const { todayUtc, maxUtc } = getGenerationWindow();
    return dates.every((d) => d >= todayUtc && d <= maxUtc);
  }, "Pick days within the next 7 days.");

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

function buildRevisionPrompt(
  currentSuggestion: WorkoutSuggestion,
  feedback: string,
  targetDate: Date,
  libraryLines: string[],
) {
  const system = [
    "You are a fitness coaching assistant inside a workout tracking app.",
    "The user has already seen a suggested workout below and wants a specific change made to it, not a brand new workout.",
    "Apply the requested change and return the complete revised workout structure matching the provided tool schema - not just the changed parts.",
    "Keep everything else about the workout the same unless the requested change reasonably requires other adjustments (e.g. swapping an exercise for one working the same muscle group, or only touching the rounds/rest of the block the feedback is about).",
    "Prefer reusing the user's existing exercise names from their library when a suitable match exists, rather than inventing near-duplicate names.",
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
    `Current suggested workout:\n${JSON.stringify(currentSuggestion)}`,
    "",
    `Requested change: ${feedback}`,
    "",
    libraryLines.length > 0
      ? `User's existing exercise library:\n${libraryLines.join("\n")}`
      : "User's existing exercise library: empty.",
  ].join("\n");

  return { system, prompt };
}

function buildMultiDayPrompt(
  freeText: string,
  dates: Date[],
  historyLines: string[],
  libraryLines: string[],
) {
  const numDays = dates.length;
  const system = [
    "You are a fitness coaching assistant inside a workout tracking app.",
    `Generate a workout plan as a structured suggestion matching the provided tool schema - exactly ${numDays} entries in "days", one per listed date below, in the same order.`,
    "The listed dates are the days the user has chosen to work out - there may or may not be a rest day between any given pair, which you can tell from the calendar dates themselves. Vary the plan sensibly: avoid repeating the same muscle group between two listed days with no gap between them, and use bigger gaps for more overlap if that suits the user's request.",
    "Prefer reusing the user's existing exercise names from their library when a suitable match exists, rather than inventing near-duplicate names.",
    "Keep each day's workout realistic in scope: 1-6 blocks, each with 1-5 exercises, sensible round counts (1-5), and sensible rest periods.",
    "Avoid heavily repeating muscle groups the user trained in the 1-2 days before the first listed date, if that history is available.",
    "Each day's label should describe the workout itself (e.g. its muscle focus or theme), not the day number or date - the app already displays those separately.",
  ].join(" ");

  const dateLines = dates.map((date, index) => {
    const label = date.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      timeZone: "UTC",
    });
    return `${index + 1}. ${label}`;
  });

  const prompt = [
    `Generate workouts for these ${numDays} chosen day${numDays === 1 ? "" : "s"}, in order:\n${dateLines.join("\n")}`,
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

export type GeneratePlanFormState =
  | {
      error?: string;
      days?: WorkoutSuggestion[];
      planId?: string;
      dates?: string[];
    }
  | undefined;

// PRD 7.2 "range of days" scope: one LLM call returns a suggestion per day
// so it can spread variety/spacing across the whole batch (see
// buildMultiDayPrompt), rather than N independent single-day calls. The
// client resolves "how many/which days" down to a concrete, already-sorted
// list of ISO dates before submitting - either auto-spaced across the next
// week (SPACED_OFFSETS_BY_COUNT in multi-day-generate-form.tsx) or the
// user's own calendar picks - so this action only has to validate the
// result, not decide scheduling itself. A WorkoutPlan row is created once
// generation actually succeeds (grouping this batch, per PRD Section 9),
// and its id is threaded through to each day's accept so the resulting
// sessions share it - not created eagerly before the Claude call, so a
// failed generation doesn't leave an empty plan row behind.
export async function generateWorkoutPlanAction(
  _prevState: GeneratePlanFormState,
  formData: FormData,
): Promise<GeneratePlanFormState> {
  const session = await auth();
  if (!session?.user) {
    return { error: "You must be logged in." };
  }

  const parsedFreeText = freeTextSchema.safeParse(
    formData.get("freeText") ?? "",
  );
  const freeText = parsedFreeText.success ? parsedFreeText.data : "";

  const rawDates = formData
    .getAll("dates")
    .filter((v): v is string => typeof v === "string");
  const parsedDates = datesArraySchema.safeParse(rawDates);
  if (!parsedDates.success) {
    return {
      error: parsedDates.error.issues[0]?.message ?? "Pick at least 1 day.",
    };
  }
  const dates = parsedDates.data;

  const { historyLines, libraryLines } = await buildGenerationContext(
    session.user.id,
  );
  const { system, prompt } = buildMultiDayPrompt(
    freeText,
    dates,
    historyLines,
    libraryLines,
  );

  try {
    const result = await requestStructuredOutput({
      system,
      prompt,
      schema: multiDaySuggestionSchema,
      toolDescription: `Return the workout plan structure matching the schema, with exactly ${dates.length} entries in "days", one per listed date in order.`,
    });

    if (result.days.length !== dates.length) {
      console.error(
        `Multi-day generation returned ${result.days.length} days, expected ${dates.length}.`,
      );
      return {
        error: "Couldn't generate the right number of days. Try again.",
      };
    }

    const plan = await prisma.workoutPlan.create({
      data: {
        userId: session.user.id,
        startDate: dates[0],
        numDays: dates.length,
        sourcePrompt: freeText.trim() || null,
      },
    });

    return {
      days: result.days,
      planId: plan.id,
      dates: dates.map((d) => d.toISOString().slice(0, 10)),
    };
  } catch (error) {
    console.error("Workout plan generation failed:", error);
    return {
      error:
        "Couldn't generate a plan right now. Try again, or generate a single day instead.",
    };
  }
}

// Applies a specific user-requested change to an already-generated
// suggestion (e.g. "swap burpees for mountain climbers", "make the finisher
// less intense") and returns the revised suggestion, without persisting
// anything - the user can keep revising, regenerate from scratch, or accept,
// same as the initial suggestion from generateWorkoutSuggestionAction. Also
// reused as-is to revise a single day within a multi-day plan (PR-16) -
// same shape, no plan-awareness needed since revising doesn't touch the DB.
export async function reviseWorkoutSuggestionAction(
  _prevState: GenerateFormState,
  formData: FormData,
): Promise<GenerateFormState> {
  const session = await auth();
  if (!session?.user) {
    return { error: "You must be logged in." };
  }

  const raw = formData.get("currentSuggestion");
  if (typeof raw !== "string") {
    return { error: "Missing current suggestion." };
  }

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return { error: "Invalid suggestion data." };
  }

  const parsedCurrent = workoutSuggestionSchema.safeParse(json);
  if (!parsedCurrent.success) {
    return { error: "Invalid suggestion data." };
  }

  const parsedFeedback = feedbackSchema.safeParse(formData.get("feedback"));
  if (!parsedFeedback.success) {
    return {
      error:
        parsedFeedback.error.issues[0]?.message ??
        "Describe what you'd like to change.",
    };
  }

  const parsedDate = dateSchema.safeParse(formData.get("date"));
  if (!parsedDate.success) {
    return {
      error: parsedDate.error.issues[0]?.message ?? "Pick a valid date.",
    };
  }
  const targetDate = parsedDate.data;
  const dateIso = targetDate.toISOString().slice(0, 10);

  const { libraryLines } = await buildGenerationContext(session.user.id);
  const { system, prompt } = buildRevisionPrompt(
    parsedCurrent.data,
    parsedFeedback.data,
    targetDate,
    libraryLines,
  );

  try {
    const suggestion = await requestStructuredOutput({
      system,
      prompt,
      schema: workoutSuggestionSchema,
      toolDescription:
        "Return the revised single day's suggested workout structure matching the schema.",
    });
    return { suggestion, date: dateIso };
  } catch (error) {
    console.error("Workout revision failed:", error);
    return {
      error:
        "Couldn't apply that change right now. Try again, or accept the workout as-is.",
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
  planId?: string,
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
          planId,
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
            targetReps: exercise.suggestedSet.reps,
            targetDurationSeconds: exercise.suggestedSet.durationSeconds,
            targetDistanceMeters: exercise.suggestedSet.distanceMeters,
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

const planIdSchema = z.string().min(1, "Missing plan.");

export type AcceptDayFormState =
  { error?: string; sessionId?: string } | undefined;

// Accepts a single day within a multi-day plan (PR-16). Unlike
// acceptWorkoutSuggestionAction, this doesn't redirect - other days in the
// same batch may still be under review, so the caller stays on the plan
// review screen and reflects this day as accepted in place.
export async function acceptDayInPlanAction(
  _prevState: AcceptDayFormState,
  formData: FormData,
): Promise<AcceptDayFormState> {
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

  const parsedPlanId = planIdSchema.safeParse(formData.get("planId"));
  if (!parsedPlanId.success) {
    return { error: "Missing plan." };
  }

  const newSessionId = await persistWorkoutSuggestion(
    session.user.id,
    parsed.data,
    parsedDate.data,
    parsedPlanId.data,
  );

  return { sessionId: newSessionId };
}
