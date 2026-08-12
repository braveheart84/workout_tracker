import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { OnboardingWizard } from "./onboarding-wizard";

export default async function OnboardingPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 p-8">
      <OnboardingWizard />
    </main>
  );
}
