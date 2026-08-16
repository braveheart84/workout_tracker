import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getUserTimezone, todayInTimezone } from "@/lib/user-date";
import { BottomNav } from "@/components/bottom-nav";
import { UploadRunForm } from "./upload-run-form";

export default async function NewRunPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const [user, timezone] = await Promise.all([
    prisma.user.findUniqueOrThrow({
      where: { id: session.user.id },
      select: { unitSystem: true },
    }),
    getUserTimezone(),
  ]);
  const todayIso = todayInTimezone(timezone).toISOString().slice(0, 10);
  const defaultDistanceUnit = user.unitSystem === "IMPERIAL" ? "mi" : "km";

  return (
    <main className="flex flex-1 flex-col items-center gap-6 p-8">
      <div className="w-full max-w-lg space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold tracking-tight">Log a Run</h1>
          <Link href="/dashboard" className="text-sm underline">
            Back to dashboard
          </Link>
        </div>

        <UploadRunForm todayIso={todayIso} defaultDistanceUnit={defaultDistanceUnit} />

        <div className="h-20" aria-hidden="true" />
      </div>
      <BottomNav />
    </main>
  );
}
