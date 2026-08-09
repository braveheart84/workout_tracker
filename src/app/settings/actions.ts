"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const settingsSchema = z.object({
  unitSystem: z.enum(["METRIC", "IMPERIAL"]),
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
  });

  if (!parsed.success) {
    return { error: "Invalid input." };
  }

  const remindersEnabled = formData.get("remindersEnabled") === "on";

  await prisma.user.update({
    where: { id: session.user.id },
    data: {
      unitSystem: parsed.data.unitSystem,
      remindersEnabled,
    },
  });

  revalidatePath("/settings");
  return { success: true };
}
