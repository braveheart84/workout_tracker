"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getUserTimezone, todayInTimezone } from "@/lib/user-date";

export async function startAdHocWorkoutAction() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const timezone = await getUserTimezone();
  const workoutSession = await prisma.workoutSession.create({
    data: {
      userId: session.user.id,
      date: todayInTimezone(timezone),
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

// Reschedule just moves a planned session's date - used both for PRD 7.3
// "skipped days" (a planned session whose date has passed without ever
// being started) and for moving a not-yet-due future plan to a different
// day. No upper bound like generation's 7-day window, since this is
// repositioning an already-planned session rather than asking the LLM to
// generate one. A factory (rather than a static schema) since "today"
// depends on the user's timezone, which is only known once the action
// reads it.
function makeRescheduleDateSchema(todayUtc: Date) {
  return z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a valid date.")
    .transform((v) => new Date(`${v}T00:00:00.000Z`))
    .refine((d) => !Number.isNaN(d.getTime()), "Pick a valid date.")
    .refine((d) => d >= todayUtc, "Pick today or a future date.");
}

export type RescheduleFormState = { error?: string } | undefined;

export async function reschedulePlannedSessionAction(
  id: string,
  _prevState: RescheduleFormState,
  formData: FormData,
): Promise<RescheduleFormState> {
  const session = await auth();
  if (!session?.user) {
    return { error: "You must be logged in." };
  }

  const timezone = await getUserTimezone();
  const rescheduleDateSchema = makeRescheduleDateSchema(
    todayInTimezone(timezone),
  );
  const parsed = rescheduleDateSchema.safeParse(formData.get("date"));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Pick a valid date." };
  }

  const result = await prisma.workoutSession.updateMany({
    where: { id, userId: session.user.id, status: "PLANNED" },
    data: { date: parsed.data },
  });
  if (result.count === 0) {
    return { error: "Workout not found or no longer pending." };
  }

  revalidatePath("/dashboard");
  revalidatePath("/history");
  revalidatePath("/week");
  revalidatePath(`/workouts/${id}`);
  return undefined;
}

async function markPlannedSessionDiscarded(userId: string, id: string) {
  await prisma.workoutSession.updateMany({
    where: { id, userId, status: "PLANNED" },
    data: { status: "DISCARDED" },
  });
  revalidatePath("/dashboard");
  revalidatePath("/history");
  revalidatePath("/week");
}

// Used by SkippedDayBanner on the dashboard - stays in place afterward (no
// redirect), the discarded card just disappears once the banner's list
// re-renders via the revalidatePath calls above.
export async function discardSkippedSessionAction(id: string) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  await markPlannedSessionDiscarded(session.user.id, id);
}

// Used from the workout detail page itself - any planned day, not just a
// skipped (already-past) one, since there was previously no way to cancel
// a future planned workout at all. Redirects to /dashboard afterward,
// since a page for a session that's now DISCARDED has nothing useful left
// to show (unlike the skipped-day banner, which is already on the
// dashboard and just needs the one card to disappear).
export async function discardPlannedWorkoutAction(id: string) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  await markPlannedSessionDiscarded(session.user.id, id);
  redirect("/dashboard");
}

// Permanently removes a past (COMPLETED or DISCARDED) workout - unlike
// discard above, which only flips a PLANNED session's status, this deletes
// the row outright (cascading to its blocks/exercises/sets per the schema's
// onDelete: Cascade). Deliberately excludes PLANNED/IN_PROGRESS - those
// have their own discard/reschedule flows for backing out of a workout
// that hasn't happened (or is happening) yet, and losing in-progress
// logging to a stray delete click would be a much costlier mistake than
// removing something already finished. Redirects to /history rather than
// /dashboard (contrast discardPlannedWorkoutAction) since a past workout
// being deleted is a history-management action, not a today's-plan one.
export async function deleteWorkoutSessionAction(id: string) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  await prisma.workoutSession.deleteMany({
    where: { id, userId: session.user.id, status: { in: ["COMPLETED", "DISCARDED"] } },
  });

  revalidatePath("/dashboard");
  revalidatePath("/history");
  revalidatePath("/week");
  redirect("/history");
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

  // Deliberately no revalidatePath call here, on this or any other path -
  // per Next's Server Actions model, calling revalidatePath/updateTag/
  // refresh from an action re-renders the *invoking* route (this one,
  // /workouts/[id]) as part of the same response regardless of which path
  // string is passed. That would swap the now-COMPLETED session's parent
  // Server Component render in before FinishWorkoutForm's own "just
  // finished" splash state ever gets a chance to show. The client instead
  // does a hard navigation to /dashboard after the splash, which always
  // fetches fresh regardless of any client-side route cache.
  return { success: true };
}
