"use client";

import type { Exercise } from "@/generated/prisma/client";
import {
  moveExerciseAction,
  removeExerciseFromBlockAction,
} from "./block-actions";

export function ExerciseInBlockRow({
  sessionId,
  blockId,
  workoutExercise,
  disabled,
  isFirst,
  isLast,
}: {
  sessionId: string;
  blockId: string;
  workoutExercise: { id: string; order: number; exercise: Exercise };
  disabled: boolean;
  isFirst: boolean;
  isLast: boolean;
}) {
  const { exercise } = workoutExercise;

  return (
    <li className="flex items-center justify-between gap-4 p-2 text-sm">
      <span>
        {exercise.name}
        {exercise.muscleGroup ? (
          <span className="text-muted-foreground">
            {" "}
            · {exercise.muscleGroup}
          </span>
        ) : null}
      </span>
      {!disabled && (
        <div className="flex items-center gap-3 text-xs">
          <form
            action={moveExerciseAction.bind(
              null,
              sessionId,
              blockId,
              workoutExercise.id,
              "up",
            )}
          >
            <button
              type="submit"
              disabled={isFirst}
              className="underline disabled:opacity-30"
            >
              ↑
            </button>
          </form>
          <form
            action={moveExerciseAction.bind(
              null,
              sessionId,
              blockId,
              workoutExercise.id,
              "down",
            )}
          >
            <button
              type="submit"
              disabled={isLast}
              className="underline disabled:opacity-30"
            >
              ↓
            </button>
          </form>
          <form
            action={removeExerciseFromBlockAction.bind(
              null,
              sessionId,
              workoutExercise.id,
            )}
          >
            <button type="submit" className="text-destructive underline">
              Remove
            </button>
          </form>
        </div>
      )}
    </li>
  );
}
