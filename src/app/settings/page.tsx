import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { BottomNav } from "@/components/bottom-nav";
import { SettingsForm } from "./settings-form";

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const user = await prisma.user.findUniqueOrThrow({
    where: { id: session.user.id },
    select: { unitSystem: true, remindersEnabled: true },
  });

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 p-8">
      <div className="w-full max-w-sm space-y-6">
        <h1 className="text-2xl font-semibold tracking-tight">
          Account settings
        </h1>
        <SettingsForm
          currentUnitSystem={user.unitSystem}
          currentRemindersEnabled={user.remindersEnabled}
        />
        <div className="h-20" aria-hidden="true" />
      </div>
      <BottomNav />
    </main>
  );
}
