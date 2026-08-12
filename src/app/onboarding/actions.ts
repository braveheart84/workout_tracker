"use server";

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { preferencesSchema } from "@/lib/preferences";

export type OnboardingState = { error?: string } | undefined;

// The wizard's final step - saves whichever preferences the user picked
// across steps 2-3 (held in local state until now, one round trip instead
// of one per step) and marks onboarding complete either way, since
// reaching this step means they didn't bail out via skipOnboardingAction.
// Which button was pressed decides the destination: straight into
// generation, or back to the dashboard to explore first.
export async function completeOnboardingAction(
  _prevState: OnboardingState,
  formData: FormData,
): Promise<OnboardingState> {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const parsed = preferencesSchema.safeParse({
    unitSystem: formData.get("unitSystem"),
    preferredDurationMinutes: formData.get("preferredDurationMinutes"),
    cardioFinisherPreference: formData.get("cardioFinisherPreference"),
    availableEquipment: formData.getAll("availableEquipment"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: {
      unitSystem: parsed.data.unitSystem,
      preferredDurationMinutes: parsed.data.preferredDurationMinutes,
      cardioFinisherPreference: parsed.data.cardioFinisherPreference,
      availableEquipment: parsed.data.availableEquipment,
      onboardingCompletedAt: new Date(),
    },
  });

  redirect(
    formData.get("destination") === "dashboard" ? "/dashboard" : "/generate",
  );
}

// PRD-independent, user-requested: skipping is terminal, same as
// finishing - marks onboarding complete without saving any preferences,
// since nothing's been collected yet at the point "Skip for now" is
// reachable (step 1, before the wizard asks anything).
export async function skipOnboardingAction() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { onboardingCompletedAt: new Date() },
  });

  redirect("/dashboard");
}
