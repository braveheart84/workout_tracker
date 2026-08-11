import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { BottomNav } from "@/components/bottom-nav";
import { AddExerciseForm } from "./add-exercise-form";
import { ExerciseRow } from "./exercise-row";

export default async function ExercisesPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const exercises = await prisma.exercise.findMany({
    where: { userId: session.user.id },
    orderBy: { name: "asc" },
  });

  return (
    <main className="flex flex-1 flex-col items-center gap-6 p-8">
      <div className="w-full max-w-lg space-y-6">
        <h1 className="text-2xl font-semibold tracking-tight">
          Exercise Library
        </h1>

        <AddExerciseForm />

        {exercises.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            No exercises yet — add your first one above.
          </p>
        ) : (
          <ul className="divide-border divide-y rounded-md border">
            {exercises.map((exercise) => (
              <ExerciseRow key={exercise.id} exercise={exercise} />
            ))}
          </ul>
        )}
        <div className="h-20" aria-hidden="true" />
      </div>
      <BottomNav />
    </main>
  );
}
