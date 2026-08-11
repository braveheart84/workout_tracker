"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { requestStructuredOutput } from "@/lib/claude";
import { persistWorkoutStructure } from "@/lib/persist-workout-structure";
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
const sourceTextSchema = z
  .string()
  .trim()
  .min(1, "Paste a workout to import.")
  .max(6000, "That's too long to import at once - try trimming it down.");

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

async function getLibraryLines(userId: string) {
  const exercises = await prisma.exercise.findMany({
    where: { userId },
    orderBy: { name: "asc" },
  });
  return exercises.map(
    (exercise) =>
      `- ${exercise.name} (${exercise.defaultSetType.toLowerCase()}${
        exercise.muscleGroup ? `, ${exercise.muscleGroup}` : ""
      })`,
  );
}

// PRD 7.2: "consistently 'too easy' ratings ... should nudge the next
// suggestion's load/pace/volume up, and 'too hard' ratings should ease it
// back." Session-level only (the average across recent completed sessions,
// not per-exercise) - per-exercise suggested-vs-actual adaptation is a
// bigger feature (PR-19, needs Set.suggested_* fields) that doesn't exist
// yet. Ratings are 1-5, matching DIFFICULTY_LABELS ("Too Easy" .. "Too
// Hard"), so 3 is the "About Right" midpoint.
function summarizeDifficultyTrend(
  recentSessions: { difficultyRating: number | null }[],
): string | null {
  const ratings = recentSessions
    .map((s) => s.difficultyRating)
    .filter((r): r is number => r != null);
  if (ratings.length === 0) return null;

  const average = ratings.reduce((sum, r) => sum + r, 0) / ratings.length;
  const guidance =
    average <= 2
      ? "these have felt easy - nudge load/volume/pace up from what's typical for this user"
      : average >= 4
        ? "these have felt hard - ease load/volume/pace back from what's typical for this user"
        : "these have felt about right - keep a similar intensity to what's typical for this user";

  return `Average difficulty rating across the last ${ratings.length} rated session${ratings.length === 1 ? "" : "s"} (1 = Too Easy, 5 = Too Hard): ${average.toFixed(1)}/5 - ${guidance}.`;
}

async function buildGenerationContext(userId: string) {
  const fourteenDaysAgo = new Date();
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

  const [recentSessions, libraryLines] = await Promise.all([
    prisma.workoutSession.findMany({
      where: { userId, status: "COMPLETED", date: { gte: fourteenDaysAgo } },
      orderBy: { date: "desc" },
      include: {
        blocks: {
          include: { workoutExercises: { include: { exercise: true } } },
        },
      },
    }),
    getLibraryLines(userId),
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

  const difficultyTrendLine = summarizeDifficultyTrend(recentSessions);

  return { historyLines, libraryLines, difficultyTrendLine };
}

function buildPrompt(
  freeText: string,
  targetDate: Date,
  historyLines: string[],
  libraryLines: string[],
  difficultyTrendLine: string | null,
) {
  const system = [
    "You are a fitness coaching assistant inside a workout tracking app.",
    "Generate a single day's workout as a structured suggestion matching the provided tool schema.",
    "Prefer reusing the user's existing exercise names from their library when a suitable match exists, rather than inventing near-duplicate names.",
    "Keep the workout realistic in scope: 1-6 blocks, each with 1-5 exercises, sensible round counts (1-5), and sensible rest periods.",
    "Avoid heavily repeating muscle groups the user trained in the last 1-2 days, if that history is available.",
    "If a recent difficulty-rating trend is given, use it to adjust intensity: a trend toward easy ratings means nudge load/volume/pace up from what's typical for this user, a trend toward hard ratings means ease it back, and an about-right trend means keep a similar intensity.",
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
    difficultyTrendLine
      ? `Recent difficulty-rating trend: ${difficultyTrendLine}`
      : "Recent difficulty-rating trend: no rated sessions available.",
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

// Converts a workout the user already has from an external source (a coach,
// an app, a screenshot transcription) into the app's schema. Deliberately
// excludes recent workout history from the prompt and tells the model not
// to apply its own training-variety judgment - the whole point is to
// faithfully transcribe what the user already decided on, not second-guess
// it the way buildPrompt's generation intentionally does.
function buildImportPrompt(
  sourceText: string,
  targetDate: Date,
  libraryLines: string[],
) {
  const system = [
    "You are converting a workout the user pasted in from an external source (a coach, an app, a website, a screenshot transcription) into this app's structured schema.",
    "Do not invent a new workout and do not apply your own judgment about training variety, muscle group balance, or recent training history - faithfully convert the given text as closely as the schema allows, preserving the user's own programming choices.",
    "Preserve the source's structure and order: represent each distinct section (e.g. warm-up, main working sets, a finisher circuit, core work) as its own block, in the order it appears in the source.",
    "A section that's just a sequential list of exercises done once (e.g. a warm-up) is a block with roundCount 1. A section explicitly described as repeating for multiple rounds/sets is a block with that roundCount.",
    "When the source gives a range (e.g. '10-12 reps', 'rest 60-75 sec'), pick a single representative value within that range for the schema's numeric fields - do not average ranges across unrelated exercises.",
    "Only include a weight/duration/distance target if the source actually specifies one for that exercise; otherwise leave it absent rather than inventing a number.",
    "Prefer reusing the user's existing exercise names from their library when a suitable match exists, rather than inventing near-duplicate names, but never change what the exercise actually is to force a match.",
  ].join(" ");

  const targetDateLabel = targetDate.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });

  const prompt = [
    `This converted workout is for: ${targetDateLabel}.`,
    "",
    `Workout text to convert:\n${sourceText}`,
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
  difficultyTrendLine: string | null,
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
    "If a recent difficulty-rating trend is given, use it to adjust intensity across the whole plan: a trend toward easy ratings means nudge load/volume/pace up from what's typical for this user, a trend toward hard ratings means ease it back, and an about-right trend means keep a similar intensity.",
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
    difficultyTrendLine
      ? `Recent difficulty-rating trend: ${difficultyTrendLine}`
      : "Recent difficulty-rating trend: no rated sessions available.",
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

  const { historyLines, libraryLines, difficultyTrendLine } =
    await buildGenerationContext(session.user.id);
  const { system, prompt } = buildPrompt(
    freeText,
    targetDate,
    historyLines,
    libraryLines,
    difficultyTrendLine,
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

// Converts a workout pasted in from elsewhere (a coach, an app, a website)
// into the app's schema, per user request: generation's own "avoid
// repeating recent muscle groups" heuristic was overriding an explicitly
// pasted plan instead of just transcribing it. Returns the same shape as
// generateWorkoutSuggestionAction so it plugs into the same review/revise/
// accept UI - only the prompt (buildImportPrompt, no history context) and
// input (raw text instead of free-form notes) differ.
export async function importWorkoutTextAction(
  _prevState: GenerateFormState,
  formData: FormData,
): Promise<GenerateFormState> {
  const session = await auth();
  if (!session?.user) {
    return { error: "You must be logged in." };
  }

  const parsedSourceText = sourceTextSchema.safeParse(
    formData.get("sourceText"),
  );
  if (!parsedSourceText.success) {
    return {
      error:
        parsedSourceText.error.issues[0]?.message ??
        "Paste a workout to import.",
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

  const libraryLines = await getLibraryLines(session.user.id);
  const { system, prompt } = buildImportPrompt(
    parsedSourceText.data,
    targetDate,
    libraryLines,
  );

  try {
    const suggestion = await requestStructuredOutput({
      system,
      prompt,
      schema: workoutSuggestionSchema,
      toolDescription:
        "Return the converted workout structure matching the schema, faithfully transcribing the pasted source.",
    });
    return { suggestion, date: dateIso };
  } catch (error) {
    console.error("Workout import failed:", error);
    return {
      error:
        "Couldn't convert that workout right now. Try again, or simplify the pasted text.",
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

  const { historyLines, libraryLines, difficultyTrendLine } =
    await buildGenerationContext(session.user.id);
  const { system, prompt } = buildMultiDayPrompt(
    freeText,
    dates,
    historyLines,
    libraryLines,
    difficultyTrendLine,
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

  const newSessionId = await persistWorkoutStructure(
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

  const newSessionId = await persistWorkoutStructure(
    session.user.id,
    parsed.data,
    parsedDate.data,
    { planId: parsedPlanId.data },
  );

  return { sessionId: newSessionId };
}
