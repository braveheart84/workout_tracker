import { prisma } from "@/lib/prisma";
import type {
  WorkoutSessionSource,
  WorkoutSessionStatus,
} from "@/generated/prisma/client";
import type { WorkoutSuggestion } from "@/lib/workout-suggestion-schema";

// Shared by every path that turns a WorkoutSuggestion-shaped structure into
// real WorkoutSession/WorkoutBlock/WorkoutExercise rows: accepting an AI
// suggestion or a plan day (generate/actions.ts), and starting a workout
// from a saved template (templates/actions.ts, PR-20) - the same shape,
// the same exercise-resolution/persistence rules, just a different status
// and source depending on how the session came to exist.
export async function persistWorkoutStructure(
  userId: string,
  suggestion: WorkoutSuggestion,
  date: Date,
  options?: {
    planId?: string;
    status?: WorkoutSessionStatus;
    source?: WorkoutSessionSource;
    startedAt?: Date;
  },
) {
  // Resolve/create every referenced exercise up front, outside the
  // transaction and in parallel. Looping one upsert + one WorkoutExercise
  // create per exercise *inside* the transaction meant a larger structure
  // (multiple blocks, several exercises each) could easily blow past
  // Prisma's 5s interactive-transaction timeout (P2028) under normal
  // network latency. Doing it here means an upsert can't be rolled back by
  // a later failure in the transaction, but a stray unused library exercise
  // is harmless - it just gets reused if the same structure is retried.
  const exercisesByName = new Map(
    suggestion.blocks
      .flatMap((block) => block.exercises)
      .map((exercise) => [exercise.name, exercise]),
  );
  const resolvedExercises = await Promise.all(
    Array.from(exercisesByName.values()).map((exercise) =>
      prisma.exercise.upsert({
        where: { userId_name: { userId, name: exercise.name } },
        update: {},
        create: {
          userId,
          name: exercise.name,
          muscleGroup: exercise.muscleGroup,
          defaultSetType: exercise.suggestedSet.setType,
        },
      }),
    ),
  );
  const exerciseIdByName = new Map(
    resolvedExercises.map((exercise) => [exercise.name, exercise.id]),
  );

  return prisma.$transaction(
    async (tx) => {
      const workoutSession = await tx.workoutSession.create({
        data: {
          userId,
          date,
          status: options?.status ?? "PLANNED",
          type: "STRENGTH",
          label: suggestion.label,
          source: options?.source ?? "AI_GENERATED",
          planId: options?.planId,
          startedAt: options?.startedAt,
        },
      });

      // Batched instead of one create per block/exercise - the transaction
      // does a fixed 3 round trips regardless of structure size.
      const createdBlocks = await tx.workoutBlock.createManyAndReturn({
        data: suggestion.blocks.map((block, blockIndex) => ({
          sessionId: workoutSession.id,
          order: blockIndex,
          roundCount: block.roundCount,
          restSeconds: block.restSeconds,
        })),
      });
      const blockIdByOrder = new Map(
        createdBlocks.map((block) => [block.order, block.id]),
      );

      await tx.workoutExercise.createMany({
        data: suggestion.blocks.flatMap((block, blockIndex) =>
          block.exercises.map((exercise, exerciseIndex) => ({
            blockId: blockIdByOrder.get(blockIndex)!,
            exerciseId: exerciseIdByName.get(exercise.name)!,
            order: exerciseIndex,
            targetReps: exercise.suggestedSet.reps,
            targetDurationSeconds: exercise.suggestedSet.durationSeconds,
            targetDistanceMeters: exercise.suggestedSet.distanceMeters,
            targetWeight: exercise.suggestedSet.weight,
            targetWeightUnit: exercise.suggestedSet.weightUnit,
          })),
        ),
      });

      return workoutSession.id;
    },
    { timeout: 15000 },
  );
}
