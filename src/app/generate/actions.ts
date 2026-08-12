"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  requestStructuredOutput,
  ClaudeStructuredOutputError,
} from "@/lib/claude";
import { persistWorkoutStructure } from "@/lib/persist-workout-structure";
import {
  workoutSuggestionSchema,
  multiDaySuggestionSchema,
  type WorkoutSuggestion,
} from "@/lib/workout-suggestion-schema";
import { FOCUS_AREAS } from "@/lib/focus-area";
import { formatTarget } from "@/lib/format-set-summary";
import { getUserTimezone, todayInTimezone } from "@/lib/user-date";

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

// PRD 7.2's focus-area shortcut: 0 or more of the fixed set, alongside the
// existing free text rather than instead of it.
const focusTagsSchema = z.array(z.enum(FOCUS_AREAS)).max(FOCUS_AREAS.length);

// Shared by every generation action's catch block. A non-transient failure
// (see ClaudeStructuredOutputError.isTransient) means retrying will fail
// the same way again - "Try again" would be actively misleading there, so
// it gets one fixed message regardless of what the action was doing.
// transientMessage is the action-specific message used for every other
// failure (a Claude hiccup, a malformed response), same as before this
// distinction existed.
function generationErrorMessage(
  error: unknown,
  transientMessage: string = "Couldn't generate a workout right now. Try again, or start one manually.",
): string {
  if (error instanceof ClaudeStructuredOutputError && !error.isTransient) {
    return "Workout generation is temporarily unavailable. We've been notified - please check back later, or start a workout manually.";
  }
  return transientMessage;
}

// Matches PRD 7.2's generation horizon (a range request asks for 1-7 days) -
// today through 6 days out, shared by both the single-day date field and
// the multi-day dates array below. "Today" depends on the user's timezone
// (see src/lib/user-date.ts), which is only known once read from cookies
// inside a request, so this is async and called fresh per-action rather
// than computed once at module scope.
async function getGenerationWindow() {
  const timezone = await getUserTimezone();
  const todayUtc = todayInTimezone(timezone);
  const maxUtc = new Date(todayUtc);
  maxUtc.setUTCDate(maxUtc.getUTCDate() + 6);
  return { todayUtc, maxUtc };
}

function makeDateSchema(todayUtc: Date, maxUtc: Date) {
  return z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a valid date.")
    .transform((v) => new Date(`${v}T00:00:00.000Z`))
    .refine((d) => !Number.isNaN(d.getTime()), "Pick a valid date.")
    .refine(
      (d) => d >= todayUtc && d <= maxUtc,
      "Pick a date within the next 7 days.",
    );
}

// PRD 7.2's "range of days" scope, refined per user feedback after PR-16's
// first cut: rather than a single day count implying N *consecutive* days,
// the user picks which specific day(s) within the next week to generate
// for - either by count (auto-spaced with rest days between, see
// SPACED_OFFSETS_BY_COUNT client-side) or by checking exact days on a
// calendar. Either way, the client resolves that down to a concrete list of
// ISO dates and this is what actually gets validated server-side.
function makeDatesArraySchema(todayUtc: Date, maxUtc: Date) {
  return z
    .array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick valid days."))
    .min(1, "Pick at least 1 day.")
    .max(7, "Pick at most 7 days.")
    .refine(
      (arr) => new Set(arr).size === arr.length,
      "Duplicate day selected.",
    )
    .transform((arr) =>
      arr
        .map((v) => new Date(`${v}T00:00:00.000Z`))
        .sort((a, b) => a.getTime() - b.getTime()),
    )
    .refine(
      (dates) => dates.every((d) => !Number.isNaN(d.getTime())),
      "Pick valid days.",
    )
    .refine(
      (dates) => dates.every((d) => d >= todayUtc && d <= maxUtc),
      "Pick days within the next 7 days.",
    );
}

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

// Shared verbatim by buildPrompt and buildMultiDayPrompt, which previously
// carried identical copies that could drift out of sync when tuned in only
// one place. buildRevisionPrompt uses its own shorter variant deliberately -
// it isn't seeking variety, just naming consistency for the one exercise
// being touched - so it isn't folded into this constant.
const LIBRARY_NAMING_GUIDANCE =
  "When you land on an exercise that's essentially the same movement as one already in the user's library, use that exact library name instead of inventing a near-duplicate (e.g. 'Back Squat' rather than a new 'Barbell Squat' entry) - but treat the library as a naming-consistency aid only, not a menu to pick from: don't let it limit variety, and introducing an exercise the user hasn't logged before is often the better call, especially for accessory, core, and finisher work.";

// Difficulty-trend/performance-delta calibration (see below) only ever
// nudges intensity relative to "what's typical for this user" - with little
// or no history to establish that baseline, there's nothing safe to nudge
// away from, so the model should land on a moderate starting point rather
// than guessing aggressively.
const CONSERVATIVE_DEFAULT_GUIDANCE =
  "When recent history, difficulty ratings, or performance data are sparse or unavailable, default to a moderate, conservative starting point for load, volume, and pace rather than an aggressive one - it's a smaller problem for the user to report a session felt easy than to overreach on limited information.";

async function getUserPreferences(userId: string) {
  return prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: {
      preferredDurationMinutes: true,
      cardioFinisherPreference: true,
      availableEquipment: true,
      avoidedExercisesNote: true,
    },
  });
}

// Formats the standing Account settings preferences into prompt text.
// Equipment and avoided-exercises are hard constraints - threaded into
// revision too (a revision shouldn't suggest something the user can't do
// or explicitly ruled out), unlike duration/cardio-finisher, which are
// whole-session-shape preferences only relevant to a full generation.
function formatPreferenceLines(preferences: {
  preferredDurationMinutes: number | null;
  cardioFinisherPreference: "ALWAYS" | "NEVER" | "SOMETIMES";
  availableEquipment: string[];
  avoidedExercisesNote: string | null;
}) {
  const durationLine =
    preferences.preferredDurationMinutes != null
      ? `Target session length: about ${preferences.preferredDurationMinutes} minutes total (including work and rest) - size the number of blocks/rounds/rest periods to roughly fit; it doesn't need to be exact.`
      : null;

  const cardioFinisherLine =
    preferences.cardioFinisherPreference === "ALWAYS"
      ? "The user always wants a short cardio finisher block at the end of a strength session."
      : preferences.cardioFinisherPreference === "NEVER"
        ? "The user never wants a cardio finisher block - keep the session focused on the main work only."
        : null;

  const equipmentLine =
    preferences.availableEquipment.length > 0
      ? `Only suggest exercises usable with this equipment: ${preferences.availableEquipment.join(", ")}.`
      : null;

  const avoidLine = preferences.avoidedExercisesNote
    ? `The user has asked to avoid: ${preferences.avoidedExercisesNote}. Do not suggest exercises that conflict with this.`
    : null;

  return { durationLine, cardioFinisherLine, equipmentLine, avoidLine };
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

// PRD 7.2/7.6: "the AI's future suggestions [should] reflect what I actually
// lifted or ran, not just what it originally suggested." Per-exercise
// (unlike summarizeDifficultyTrend's session-level average) since
// Set.suggested_* (PR-19) snapshots what was targeted alongside what was
// actually logged for every round logged against a planned/templated
// exercise - a manually-added exercise never populates suggested_*, so it's
// naturally excluded here as having nothing to compare against.
function summarizePerformanceDeltas(
  recentSessions: {
    blocks: {
      workoutExercises: {
        exercise: { name: string };
        sets: {
          setType: "REPS" | "DURATION" | "DISTANCE";
          reps: number | null;
          suggestedReps: number | null;
          durationSeconds: number | null;
          suggestedDurationSeconds: number | null;
          distanceMeters: number | null;
          suggestedDistanceMeters: number | null;
          weight: number | null;
          weightUnit: "KG" | "LB" | null;
          suggestedWeight: number | null;
          suggestedWeightUnit: "KG" | "LB" | null;
        }[];
      }[];
    }[];
  }[],
): string[] {
  type Samples = {
    actual: number[];
    suggested: number[];
    format: (n: number) => string;
    weightActual: number[];
    weightSuggested: number[];
    weightUnit: "KG" | "LB" | null;
  };
  const byExercise = new Map<string, Samples>();

  for (const session of recentSessions) {
    for (const block of session.blocks) {
      for (const we of block.workoutExercises) {
        for (const set of we.sets) {
          let samples = byExercise.get(we.exercise.name);
          if (!samples) {
            samples = {
              actual: [],
              suggested: [],
              format:
                set.setType === "REPS"
                  ? (n) => `${Math.round(n)} reps`
                  : set.setType === "DURATION"
                    ? (n) => `${Math.round(n)}s`
                    : (n) => `${Math.round(n)}m`,
              weightActual: [],
              weightSuggested: [],
              weightUnit: null,
            };
            byExercise.set(we.exercise.name, samples);
          }

          if (
            set.setType === "REPS" &&
            set.reps != null &&
            set.suggestedReps != null
          ) {
            samples.actual.push(set.reps);
            samples.suggested.push(set.suggestedReps);
          } else if (
            set.setType === "DURATION" &&
            set.durationSeconds != null &&
            set.suggestedDurationSeconds != null
          ) {
            samples.actual.push(set.durationSeconds);
            samples.suggested.push(set.suggestedDurationSeconds);
          } else if (
            set.setType === "DISTANCE" &&
            set.distanceMeters != null &&
            set.suggestedDistanceMeters != null
          ) {
            samples.actual.push(set.distanceMeters);
            samples.suggested.push(set.suggestedDistanceMeters);
          }

          // Only compared when the unit matches - a suggestion logged in kg
          // and later switched to lb (or vice versa) isn't a meaningful
          // delta without a conversion this app doesn't do elsewhere.
          if (
            set.weight != null &&
            set.suggestedWeight != null &&
            set.weightUnit != null &&
            set.weightUnit === set.suggestedWeightUnit
          ) {
            samples.weightActual.push(set.weight);
            samples.weightSuggested.push(set.suggestedWeight);
            samples.weightUnit = set.weightUnit;
          }
        }
      }
    }
  }

  const average = (nums: number[]) =>
    nums.reduce((sum, n) => sum + n, 0) / nums.length;

  const describe = (
    avgActual: number,
    avgSuggested: number,
    format: (n: number) => string,
  ) => {
    const ratio =
      avgSuggested === 0 ? 0 : (avgActual - avgSuggested) / avgSuggested;
    const direction =
      ratio > 0.1
        ? "running ahead of the suggested target - consider nudging it up"
        : ratio < -0.1
          ? "falling short of the suggested target - consider easing it back"
          : "roughly matching the suggested target";
    return `averaged ${format(avgActual)} vs a suggested ${format(avgSuggested)} (${direction})`;
  };

  const lines: string[] = [];
  for (const [name, samples] of byExercise) {
    const clauses: string[] = [];
    if (samples.actual.length > 0) {
      clauses.push(
        describe(
          average(samples.actual),
          average(samples.suggested),
          samples.format,
        ),
      );
    }
    if (samples.weightActual.length > 0 && samples.weightUnit) {
      const weightUnit = samples.weightUnit;
      clauses.push(
        `load ${describe(
          average(samples.weightActual),
          average(samples.weightSuggested),
          (n) => `${Math.round(n * 10) / 10}${weightUnit.toLowerCase()}`,
        )}`,
      );
    }
    if (clauses.length > 0) {
      lines.push(`- ${name}: ${clauses.join("; ")}`);
    }
  }
  return lines.sort();
}

async function buildGenerationContext(userId: string) {
  const fourteenDaysAgo = new Date();
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

  const [recentSessions, libraryLines, preferences] = await Promise.all([
    prisma.workoutSession.findMany({
      where: { userId, status: "COMPLETED", date: { gte: fourteenDaysAgo } },
      orderBy: { date: "desc" },
      include: {
        blocks: {
          include: {
            workoutExercises: { include: { exercise: true, sets: true } },
          },
        },
      },
    }),
    getLibraryLines(userId),
    getUserPreferences(userId),
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
  const performanceDeltaLines = summarizePerformanceDeltas(recentSessions);
  const { durationLine, cardioFinisherLine, equipmentLine, avoidLine } =
    formatPreferenceLines(preferences);

  return {
    historyLines,
    libraryLines,
    difficultyTrendLine,
    performanceDeltaLines,
    durationLine,
    cardioFinisherLine,
    equipmentLine,
    avoidLine,
  };
}

function formatExerciseTarget(we: {
  targetReps: number | null;
  targetDurationSeconds: number | null;
  targetDistanceMeters: number | null;
  targetWeight: number | null;
  targetWeightUnit: "KG" | "LB" | null;
  exercise: { name: string; defaultSetType: "REPS" | "DURATION" | "DISTANCE" };
}) {
  const value =
    we.exercise.defaultSetType === "REPS"
      ? we.targetReps
      : we.exercise.defaultSetType === "DURATION"
        ? we.targetDurationSeconds
        : we.targetDistanceMeters;
  const target = formatTarget(we.exercise.defaultSetType, value);
  const weight =
    we.targetWeight != null
      ? `${we.targetWeight}${(we.targetWeightUnit ?? "KG").toLowerCase()}`
      : null;
  const detail = [target, weight].filter(Boolean).join(" @ ");
  return detail ? `${we.exercise.name} (${detail})` : we.exercise.name;
}

// PRD 7.2: "repeat a previous workout: 'same as last week' - regenerates
// using a specific past session... as the baseline." A fuller block/
// exercise breakdown than historyLines' one-line-per-session summary, since
// this is the actual structure the new plan should vary around, not just
// context. Ownership-checked, since the id comes straight from client
// formData - returns null for a missing/foreign session, treated the same
// as "no baseline given" rather than an error, since regenerating without
// one is a reasonable fallback.
async function getBaselineSessionLines(userId: string, sessionId: string) {
  const baseline = await prisma.workoutSession.findFirst({
    where: { id: sessionId, userId },
    include: {
      blocks: {
        orderBy: { order: "asc" },
        include: {
          workoutExercises: {
            orderBy: { order: "asc" },
            include: { exercise: true },
          },
        },
      },
    },
  });
  if (!baseline) return null;

  const blockLines = baseline.blocks.map((block) => {
    const exerciseParts = block.workoutExercises.map(formatExerciseTarget);
    return `  - ${block.roundCount} round${block.roundCount === 1 ? "" : "s"}${block.restSeconds ? `, ${block.restSeconds}s rest` : ""}: ${exerciseParts.join(", ")}`;
  });

  return {
    label: baseline.label || "Workout",
    dateIso: baseline.date.toISOString().slice(0, 10),
    lines: blockLines,
  };
}

type PreferenceLines = {
  durationLine: string | null;
  cardioFinisherLine: string | null;
  equipmentLine: string | null;
  avoidLine: string | null;
};

// Shared by every prompt that includes standing preference context: the
// system-instruction sentences telling the model to honor them, and the
// prompt-body lines stating what they actually are.
function preferenceSystemLines(preferences: PreferenceLines): string[] {
  const lines: string[] = [];
  if (preferences.durationLine) {
    lines.push(
      "If a target session length is given, use it to size the workout - but if the user's request states a different session length for this workout, that overrides the target session length for this generation only.",
    );
  }
  if (preferences.cardioFinisherLine) {
    lines.push(
      "If the user has a fixed cardio-finisher preference, honor it exactly rather than deciding case by case.",
    );
  }
  if (preferences.equipmentLine) {
    lines.push(
      "If the user's available equipment is given, treat it as a hard constraint - never suggest an exercise that needs equipment outside that list.",
    );
  }
  if (preferences.avoidLine) {
    lines.push(
      "If the user has exercises to avoid, treat that as a hard constraint too.",
    );
  }
  return lines;
}

function preferencePromptLines(preferences: PreferenceLines): string[] {
  return [
    preferences.durationLine ?? "Target session length: no preference given.",
    "",
    preferences.cardioFinisherLine ??
      "Cardio finisher: no fixed preference given.",
    "",
    preferences.equipmentLine ?? "Available equipment: no preference given.",
    "",
    preferences.avoidLine ?? "Exercises to avoid: none given.",
  ];
}

function buildPrompt(
  freeText: string,
  targetDate: Date,
  historyLines: string[],
  libraryLines: string[],
  difficultyTrendLine: string | null,
  performanceDeltaLines: string[],
  preferences: PreferenceLines,
) {
  const system = [
    "You are a fitness coaching assistant inside a workout tracking app.",
    "Generate a single day's workout as a structured suggestion matching the provided tool schema.",
    LIBRARY_NAMING_GUIDANCE,
    "Keep the workout realistic in scope: 1-6 blocks, each with 1-5 exercises, sensible round counts (1-5), and sensible rest periods.",
    "Avoid heavily repeating muscle groups the user trained in the last 1-2 days, if that history is available.",
    "If a recent difficulty-rating trend is given, use it to adjust intensity: a trend toward easy ratings means nudge load/volume/pace up from what's typical for this user, a trend toward hard ratings means ease it back, and an about-right trend means keep a similar intensity.",
    "If suggested-vs-actual performance is given for a specific exercise, use it to calibrate that exercise's own target ahead of the general difficulty trend: running ahead of its suggested target means nudge that exercise's target up, falling short means ease it back, and roughly matching means keep it about the same.",
    CONSERVATIVE_DEFAULT_GUIDANCE,
    ...preferenceSystemLines(preferences),
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
    performanceDeltaLines.length > 0
      ? `Suggested-vs-actual performance per exercise (last 14 days):\n${performanceDeltaLines.join("\n")}`
      : "Suggested-vs-actual performance per exercise: not enough logged data yet.",
    "",
    ...preferencePromptLines(preferences),
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
  equipmentLine: string | null,
  avoidLine: string | null,
  durationLine: string | null,
) {
  const system = [
    "You are a fitness coaching assistant inside a workout tracking app.",
    "The user has already seen a suggested workout below and wants a specific change made to it, not a brand new workout.",
    "Apply the requested change and return the complete revised workout structure matching the provided tool schema - not just the changed parts.",
    "Keep everything else about the workout the same unless the requested change reasonably requires other adjustments (e.g. swapping an exercise for one working the same muscle group, or only touching the rounds/rest of the block the feedback is about).",
    "When you land on an exercise that's essentially the same movement as one already in the user's library, use that exact library name instead of inventing a near-duplicate - but the library is a naming-consistency aid only, not a menu to pick from.",
    ...(equipmentLine
      ? [
          "The user's available equipment is a hard constraint - never suggest an exercise that needs equipment outside it, even to satisfy the requested change.",
        ]
      : []),
    ...(avoidLine
      ? ["The user's exercises-to-avoid list is a hard constraint too."]
      : []),
    ...(durationLine
      ? [
          "The user's target session length below is for reference only, not a hard constraint - a requested change that shortens or lengthens the workout should still be applied even if it moves away from that target.",
        ]
      : []),
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
    equipmentLine ?? "Available equipment: no preference given.",
    "",
    avoidLine ?? "Exercises to avoid: none given.",
    "",
    durationLine ?? "Target session length: no preference given.",
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
  performanceDeltaLines: string[],
  focusTags: string[],
  baseline: { label: string; dateIso: string; lines: string[] } | null,
  preferences: PreferenceLines,
) {
  const numDays = dates.length;
  const system = [
    "You are a fitness coaching assistant inside a workout tracking app.",
    `Generate a workout plan as a structured suggestion matching the provided tool schema - exactly ${numDays} entries in "days", one per listed date below, in the same order.`,
    "The listed dates are the days the user has chosen to work out - there may or may not be a rest day between any given pair, which you can tell from the calendar dates themselves. Vary the plan sensibly: avoid repeating the same muscle group between two listed days with no gap between them, and use bigger gaps for more overlap if that suits the user's request.",
    LIBRARY_NAMING_GUIDANCE,
    "Maximize variety across the whole plan: avoid repeating the exact same exercise on more than one of the listed days unless it's a primary compound lift this user's history shows they train very regularly, and even then vary the accessory/core/finisher exercises around it from day to day rather than repeating the same pairing every time.",
    "Keep each day's workout realistic in scope: 1-6 blocks, each with 1-5 exercises, sensible round counts (1-5), and sensible rest periods.",
    "Avoid heavily repeating muscle groups the user trained in the 1-2 days before the first listed date, if that history is available.",
    "Each day's label should describe the workout itself (e.g. its muscle focus or theme), not the day number or date - the app already displays those separately.",
    "If a recent difficulty-rating trend is given, use it to adjust intensity across the whole plan: a trend toward easy ratings means nudge load/volume/pace up from what's typical for this user, a trend toward hard ratings means ease it back, and an about-right trend means keep a similar intensity.",
    "If suggested-vs-actual performance is given for a specific exercise, use it to calibrate that exercise's own target ahead of the general difficulty trend: running ahead of its suggested target means nudge that exercise's target up, falling short means ease it back, and roughly matching means keep it about the same.",
    CONSERVATIVE_DEFAULT_GUIDANCE,
    "If one or more focus areas are given, steer the kind of session(s) you propose toward them (e.g. more strength-style blocks for 'strength', more continuous/cardio work for 'cardio', short-rest circuits for 'HIIT', stretching/control work for 'mobility') without dictating the exact exercises chosen.",
    "If a baseline workout is given, the user wants this plan to follow its structure and exercise choices as a starting point - reuse its exercises and block shape where sensible, varied and repeated across the requested days as fits the day count, and adjusted per any difficulty-trend/performance-delta context above. Don't just copy it verbatim for every day.",
    "Each preference below applies to every day in the plan, not just one.",
    ...preferenceSystemLines(preferences),
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
    focusTags.length > 0
      ? `Requested focus area(s): ${focusTags.join(", ")}`
      : "Requested focus area(s): none given.",
    "",
    baseline
      ? `Baseline workout to repeat/vary (from ${baseline.dateIso}, "${baseline.label}"):\n${baseline.lines.join("\n")}`
      : "Baseline workout to repeat: none given.",
    "",
    historyLines.length > 0
      ? `Recent workout history (last 14 days, most recent first):\n${historyLines.join("\n")}`
      : "Recent workout history: none available.",
    "",
    difficultyTrendLine
      ? `Recent difficulty-rating trend: ${difficultyTrendLine}`
      : "Recent difficulty-rating trend: no rated sessions available.",
    "",
    performanceDeltaLines.length > 0
      ? `Suggested-vs-actual performance per exercise (last 14 days):\n${performanceDeltaLines.join("\n")}`
      : "Suggested-vs-actual performance per exercise: not enough logged data yet.",
    "",
    ...preferencePromptLines(preferences),
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
  const { todayUtc, maxUtc } = await getGenerationWindow();
  const parsedDate = makeDateSchema(todayUtc, maxUtc).safeParse(dateInput);
  if (!parsedDate.success) {
    return {
      error: parsedDate.error.issues[0]?.message ?? "Pick a valid date.",
    };
  }
  const targetDate = parsedDate.data;
  const dateIso = targetDate.toISOString().slice(0, 10);

  const {
    historyLines,
    libraryLines,
    difficultyTrendLine,
    performanceDeltaLines,
    durationLine,
    cardioFinisherLine,
    equipmentLine,
    avoidLine,
  } = await buildGenerationContext(session.user.id);
  const { system, prompt } = buildPrompt(
    freeText,
    targetDate,
    historyLines,
    libraryLines,
    difficultyTrendLine,
    performanceDeltaLines,
    { durationLine, cardioFinisherLine, equipmentLine, avoidLine },
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
    // gracefully instead of crashing the page. Logged here so it's still
    // visible in server logs; requestStructuredOutput separately logs an
    // ALERT line for the non-transient (operator-needs-to-fix-it) subset.
    console.error("Workout generation failed:", error);
    return { error: generationErrorMessage(error) };
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

  const { todayUtc, maxUtc } = await getGenerationWindow();
  const parsedDate = makeDateSchema(todayUtc, maxUtc).safeParse(
    formData.get("date"),
  );
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
      error: generationErrorMessage(
        error,
        "Couldn't convert that workout right now. Try again, or simplify the pasted text.",
      ),
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
  const { todayUtc, maxUtc } = await getGenerationWindow();
  const parsedDates = makeDatesArraySchema(todayUtc, maxUtc).safeParse(
    rawDates,
  );
  if (!parsedDates.success) {
    return {
      error: parsedDates.error.issues[0]?.message ?? "Pick at least 1 day.",
    };
  }
  const dates = parsedDates.data;

  const parsedFocusTags = focusTagsSchema.safeParse(
    formData.getAll("focusTags"),
  );
  const focusTags = parsedFocusTags.success ? parsedFocusTags.data : [];

  const rawBasedOnSessionId = formData.get("basedOnSessionId");
  const basedOnSessionId =
    typeof rawBasedOnSessionId === "string" && rawBasedOnSessionId.trim()
      ? rawBasedOnSessionId.trim()
      : null;
  const baseline = basedOnSessionId
    ? await getBaselineSessionLines(session.user.id, basedOnSessionId)
    : null;

  const {
    historyLines,
    libraryLines,
    difficultyTrendLine,
    performanceDeltaLines,
    durationLine,
    cardioFinisherLine,
    equipmentLine,
    avoidLine,
  } = await buildGenerationContext(session.user.id);
  const { system, prompt } = buildMultiDayPrompt(
    freeText,
    dates,
    historyLines,
    libraryLines,
    difficultyTrendLine,
    performanceDeltaLines,
    focusTags,
    baseline,
    { durationLine, cardioFinisherLine, equipmentLine, avoidLine },
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
        focusTags,
        // Only persisted once a baseline was actually found and used -
        // a stray/foreign id (already dropped by getBaselineSessionLines
        // returning null) shouldn't be recorded as if it were applied.
        basedOnSessionId: baseline ? basedOnSessionId : null,
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
      error: generationErrorMessage(
        error,
        "Couldn't generate a plan right now. Try again, or generate a single day instead.",
      ),
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

  const { todayUtc, maxUtc } = await getGenerationWindow();
  const parsedDate = makeDateSchema(todayUtc, maxUtc).safeParse(
    formData.get("date"),
  );
  if (!parsedDate.success) {
    return {
      error: parsedDate.error.issues[0]?.message ?? "Pick a valid date.",
    };
  }
  const targetDate = parsedDate.data;
  const dateIso = targetDate.toISOString().slice(0, 10);

  const { libraryLines, equipmentLine, avoidLine, durationLine } =
    await buildGenerationContext(session.user.id);
  const { system, prompt } = buildRevisionPrompt(
    parsedCurrent.data,
    parsedFeedback.data,
    targetDate,
    libraryLines,
    equipmentLine,
    avoidLine,
    durationLine,
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
      error: generationErrorMessage(
        error,
        "Couldn't apply that change right now. Try again, or accept the workout as-is.",
      ),
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

  const { todayUtc, maxUtc } = await getGenerationWindow();
  const parsedDate = makeDateSchema(todayUtc, maxUtc).safeParse(
    formData.get("date"),
  );
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

  const { todayUtc, maxUtc } = await getGenerationWindow();
  const parsedDate = makeDateSchema(todayUtc, maxUtc).safeParse(
    formData.get("date"),
  );
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
