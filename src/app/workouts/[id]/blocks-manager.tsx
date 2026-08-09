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
    exercise: Exercise;
    sets: WorkoutSet[];
  }[];
};

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

  return (
    <div className="space-y-4">
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
