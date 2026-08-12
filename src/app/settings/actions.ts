"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { preferencesSchema } from "@/lib/preferences";
import { z } from "zod";

const settingsSchema = preferencesSchema.extend({
  avoidedExercisesNote: z
    .string()
    .max(500, "Keep it under 500 characters.")
    .transform((v) => (v.trim() === "" ? null : v.trim())),
});

export type SettingsState = { error?: string; success?: boolean } | undefined;

export async function updateSettingsAction(
  _prevState: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  const session = await auth();
  if (!session?.user) {
    return { error: "You must be logged in." };
  }

  const parsed = settingsSchema.safeParse({
    unitSystem: formData.get("unitSystem"),
    preferredDurationMinutes: formData.get("preferredDurationMinutes"),
    cardioFinisherPreference: formData.get("cardioFinisherPreference"),
    availableEquipment: formData.getAll("availableEquipment"),
    avoidedExercisesNote: formData.get("avoidedExercisesNote") ?? "",
  });

  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Invalid input.",
    };
  }

  const remindersEnabled = formData.get("remindersEnabled") === "on";

  await prisma.user.update({
    where: { id: session.user.id },
    data: {
      unitSystem: parsed.data.unitSystem,
      remindersEnabled,
      preferredDurationMinutes: parsed.data.preferredDurationMinutes,
      cardioFinisherPreference: parsed.data.cardioFinisherPreference,
      availableEquipment: parsed.data.availableEquipment,
      avoidedExercisesNote: parsed.data.avoidedExercisesNote,
    },
  });

  revalidatePath("/settings");
  return { success: true };
}
