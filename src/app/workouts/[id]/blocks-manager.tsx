import type {
  Exercise,
  Set as WorkoutSet,
  WeightUnit,
} from "@/generated/prisma/client";
import { addBlockAction } from "./block-actions";
import { BlockCard } from "./block-card";

type BlockWithExercises = {
  id: string;
  order: number;
  roundCount: number;
  restSeconds: number | null;
  workoutExercises: {
    id: string;
    order: number;
    noteForNextTime: string | null;
    targetReps: number | null;
    targetDurationSeconds: number | null;
    targetDistanceMeters: number | null;
    exercise: Exercise;
    sets: WorkoutSet[];
  }[];
};

export type CurrentPosition = { workoutExerciseId: string; round: number };

// The first round+exercise, in the order they're actually performed (block
// order, then round, then exercise order within the round - matching how
// SupersetRounds already interleaves a superset's exercises by round), that
// has no logged set yet. Used to flag "this is what's up next" so the user
// doesn't have to scan the whole page to find their place.
function findCurrentPosition(
  sortedBlocks: BlockWithExercises[],
): CurrentPosition | null {
  for (const block of sortedBlocks) {
    const sortedExercises = [...block.workoutExercises].sort(
      (a, b) => a.order - b.order,
    );
    for (let round = 1; round <= block.roundCount; round++) {
      for (const we of sortedExercises) {
        const hasSet = we.sets.some((s) => s.roundNumber === round);
        if (!hasSet) {
          return { workoutExerciseId: we.id, round };
        }
      }
    }
  }
  return null;
}

export function BlocksManager({
  sessionId,
  blocks,
  exercises,
  defaultWeightUnit,
  disabled,
}: {
  sessionId: string;
  blocks: BlockWithExercises[];
  exercises: Exercise[];
  defaultWeightUnit: WeightUnit;
  disabled: boolean;
}) {
  const sortedBlocks = [...blocks].sort((a, b) => a.order - b.order);
  // No "up next" to show for a workout that hasn't started or is already
  // over - only meaningful while it's actually being logged.
  const current = disabled ? null : findCurrentPosition(sortedBlocks);

  return (
    <div id="blocks" className="scroll-mt-4 space-y-4">
      <h2 className="text-sm font-medium">Blocks</h2>
      {sortedBlocks.length === 0 ? (
        <p className="text-muted-foreground text-sm">No blocks yet.</p>
      ) : (
        <ul className="space-y-4">
          {sortedBlocks.map((block, index) => (
            <BlockCard
              key={block.id}
              sessionId={sessionId}
              block={block}
              exercises={exercises}
              defaultWeightUnit={defaultWeightUnit}
              disabled={disabled}
              isFirst={index === 0}
              isLast={index === sortedBlocks.length - 1}
              current={current}
            />
          ))}
        </ul>
      )}
      {!disabled && (
        <form action={addBlockAction.bind(null, sessionId)}>
          <button
            type="submit"
            className="border-input w-full rounded-md border px-3 py-2 text-sm font-medium"
          >
            Add block
          </button>
        </form>
      )}
    </div>
  );
}
