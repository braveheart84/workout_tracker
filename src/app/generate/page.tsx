import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { workoutSuggestionSchema } from "@/lib/workout-suggestion-schema";
import { GenerateModeToggle } from "./generate-mode-toggle";

export default async function GeneratePage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const now = new Date();
  const todayUtc = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  const maxUtc = new Date(todayUtc);
  maxUtc.setUTCDate(maxUtc.getUTCDate() + 6);
  const todayIso = todayUtc.toISOString().slice(0, 10);
  const maxIso = maxUtc.toISOString().slice(0, 10);

  // The week view links here with ?date=... to pre-fill the day the user
  // clicked "Generate" for. Only trust it as a default if it's actually
  // within the generation window - otherwise fall back to today, same as
  // if no date were given at all.
  const { date: requestedDate } = await searchParams;
  const defaultDateIso =
    requestedDate &&
    /^\d{4}-\d{2}-\d{2}$/.test(requestedDate) &&
    requestedDate >= todayIso &&
    requestedDate <= maxIso
      ? requestedDate
      : todayIso;

  // PRD 7.2: "start from a saved template" as a generation shortcut -
  // single-day only for now (PR-20 doesn't depend on PR-16's multi-day
  // scope). Invalid rows (structure fails the current schema) are dropped
  // rather than surfaced as an error - they're just not offered as a
  // shortcut, same as any other defensive parse of stored JSON.
  const templateRows = await prisma.workoutTemplate.findMany({
    where: { userId: session.user.id },
    orderBy: { name: "asc" },
    select: { id: true, name: true, structure: true },
  });
  const templates = templateRows.flatMap((t) => {
    const parsed = workoutSuggestionSchema.safeParse(t.structure);
    return parsed.success
      ? [{ id: t.id, name: t.name, structure: parsed.data }]
      : [];
  });

  return (
    <main className="flex flex-1 flex-col items-center gap-6 p-8">
      <div className="w-full max-w-lg space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold tracking-tight">
            Generate Workout
          </h1>
          <Link href="/dashboard" className="text-sm underline">
            Back to dashboard
          </Link>
        </div>
        <GenerateModeToggle
          todayIso={todayIso}
          maxIso={maxIso}
          defaultDateIso={defaultDateIso}
          templates={templates}
        />
      </div>
    </main>
  );
}
