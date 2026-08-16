"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getUserTimezone, todayInTimezone } from "@/lib/user-date";
import {
  metersFromValue,
  parseDurationToSeconds,
  type DistanceUnit,
} from "@/lib/distance";
import { requestStructuredOutput, ClaudeStructuredOutputError } from "@/lib/claude";

const RUNNING_EXERCISE_NAME = "Running";

// ---- Screenshot extraction (PRD 7.7) ----

const IMAGE_MEDIA_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
] as const;
type ImageMediaType = (typeof IMAGE_MEDIA_TYPES)[number];

function isAllowedImageType(type: string): type is ImageMediaType {
  return (IMAGE_MEDIA_TYPES as readonly string[]).includes(type);
}

// 10MB - generous for a phone screenshot while keeping the request payload
// (base64 inflates size by ~33%) well under Claude's per-request limits.
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

const runExtractionSchema = z.object({
  distanceValue: z.number().positive().nullable(),
  distanceUnit: z.enum(["km", "mi"]).nullable(),
  durationSeconds: z.number().int().positive().nullable(),
  avgHeartRateBpm: z.number().int().positive().nullable(),
  calories: z.number().int().positive().nullable(),
});

export type RunExtraction = z.infer<typeof runExtractionSchema>;

export type ExtractRunFormState =
  | { success: true; extraction: RunExtraction }
  | { success?: false; error: string }
  | undefined;

export async function extractRunFromScreenshotAction(
  _prevState: ExtractRunFormState,
  formData: FormData,
): Promise<ExtractRunFormState> {
  const session = await auth();
  if (!session?.user) {
    return { error: "You must be logged in." };
  }

  const file = formData.get("screenshot");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Choose a screenshot to upload." };
  }
  if (!isAllowedImageType(file.type)) {
    return { error: "Upload a JPEG, PNG, GIF, or WebP image." };
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return { error: "That image is too large (max 10MB)." };
  }

  const base64Data = Buffer.from(await file.arrayBuffer()).toString("base64");

  try {
    const extraction = await requestStructuredOutput({
      system:
        "You extract running workout stats from a screenshot of a fitness-tracking app (e.g. Garmin Connect, Strava, Apple Fitness). Read only values that are actually visible and legible in the image - return null for anything you can't confidently read, rather than guessing or estimating.",
      prompt:
        "Extract this run's total distance (with its displayed unit, km or mi), total duration in seconds, average heart rate in bpm, and total calories burned.",
      schema: runExtractionSchema,
      toolDescription: "Records the run stats extracted from the screenshot.",
      image: { mediaType: file.type, base64Data },
    });
    return { success: true, extraction };
  } catch (error) {
    if (error instanceof ClaudeStructuredOutputError && !error.isTransient) {
      return {
        error:
          "Run extraction is unavailable right now - enter your run details manually below.",
      };
    }
    return {
      error:
        "Couldn't read that screenshot - try another image, or enter your run details manually below.",
    };
  }
}

// ---- Saving the run (editable-form confirmation + effort/feeling feedback) ----

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

// "today" depends on the user's timezone, only known once the action reads
// it - same factory pattern as reschedulePlannedSessionAction, but bounded
// the other direction: a run can only be logged for today or a day that's
// already happened, never a future date.
function makeRunFormSchema(todayUtc: Date) {
  return z.object({
    date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a valid date.")
      .transform((v) => new Date(`${v}T00:00:00.000Z`))
      .refine((d) => !Number.isNaN(d.getTime()), "Pick a valid date.")
      .refine((d) => d <= todayUtc, "Pick today or a past date."),
    distanceValue: z.coerce
      .number({ error: "Enter the run's distance." })
      .positive("Enter a distance greater than 0."),
    distanceUnit: z.enum(["km", "mi"], { error: "Pick a distance unit." }),
    duration: z.string().transform((v, ctx) => {
      const seconds = parseDurationToSeconds(v);
      if (seconds == null || seconds <= 0) {
        ctx.addIssue({
          code: "custom",
          message: "Enter a valid duration, e.g. 45:12 or 1:02:30.",
        });
        return z.NEVER;
      }
      return seconds;
    }),
    avgHeartRateBpm: optionalRating(1, 300, "Avg heart rate"),
    calories: optionalRating(1, 20000, "Calories"),
    difficultyRating: optionalRating(1, 5, "Effort rating"),
    difficultyNote: optionalNote(1000),
    energyRating: optionalRating(1, 10, "Energy rating"),
    goalForNext: optionalNote(1000),
  });
}

export type SaveRunFormState = { error?: string } | undefined;

export async function saveRunAction(
  _prevState: SaveRunFormState,
  formData: FormData,
): Promise<SaveRunFormState> {
  const session = await auth();
  if (!session?.user) {
    return { error: "You must be logged in." };
  }

  const timezone = await getUserTimezone();
  const parsed = makeRunFormSchema(todayInTimezone(timezone)).safeParse({
    date: formData.get("date"),
    distanceValue: formData.get("distanceValue"),
    distanceUnit: formData.get("distanceUnit"),
    duration: formData.get("duration"),
    avgHeartRateBpm: formData.get("avgHeartRateBpm"),
    calories: formData.get("calories"),
    difficultyRating: formData.get("difficultyRating"),
    difficultyNote: formData.get("difficultyNote"),
    energyRating: formData.get("energyRating"),
    goalForNext: formData.get("goalForNext"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const data = parsed.data;
  const distanceMeters = metersFromValue(
    data.distanceValue,
    data.distanceUnit as DistanceUnit,
  );

  // Reuses an existing "Running" exercise if the user already has one
  // (manually created, or from a previous run upload) rather than creating
  // a duplicate every time - same per-user exercise library every other
  // logged exercise lives in.
  const exercise = await prisma.exercise.upsert({
    where: {
      userId_name: { userId: session.user.id, name: RUNNING_EXERCISE_NAME },
    },
    create: {
      userId: session.user.id,
      name: RUNNING_EXERCISE_NAME,
      defaultSetType: "DISTANCE",
    },
    update: {},
  });

  const workoutSession = await prisma.workoutSession.create({
    data: {
      userId: session.user.id,
      date: data.date,
      status: "COMPLETED",
      type: "RUN",
      source: "MANUAL",
      label: "Run",
      completedAt: new Date(),
      difficultyRating: data.difficultyRating,
      difficultyNote: data.difficultyNote,
      energyRating: data.energyRating,
      goalForNext: data.goalForNext,
      blocks: {
        create: {
          order: 0,
          roundCount: 1,
          workoutExercises: {
            create: {
              exerciseId: exercise.id,
              order: 0,
              sets: {
                create: {
                  roundNumber: 1,
                  setType: "DISTANCE",
                  distanceMeters,
                  durationSeconds: data.duration,
                  avgHeartRateBpm: data.avgHeartRateBpm,
                  calories: data.calories,
                },
              },
            },
          },
        },
      },
    },
  });

  redirect(`/workouts/${workoutSession.id}`);
}
