"use client";

import type {
  Exercise,
  Set as WorkoutSet,
  WeightUnit,
} from "@/generated/prisma/client";
import {
  moveExerciseAction,
  removeExerciseFromBlockAction,
} from "./block-actions";
import { ExerciseNoteForm } from "./exercise-note-form";
import { RoundSets } from "./round-sets";

export function ExerciseInBlockRow({
  sessionId,
  blockId,
  roundCount,
  workoutExercise,
  defaultWeightUnit,
  disabled,
  isFirst,
  isLast,
  showRounds = true,
  currentRound,
}: {
  sessionId: string;
  blockId: string;
  roundCount: number;
  workoutExercise: {
    id: string;
    order: number;
    noteForNextTime: string | null;
    targetReps: number | null;
    targetDurationSeconds: number | null;
    targetDistanceMeters: number | null;
    exercise: Exercise;
    sets: WorkoutSet[];
  };
  defaultWeightUnit: WeightUnit;
  disabled: boolean;
  isFirst: boolean;
  isLast: boolean;
  // False for blocks with more than one exercise (supersets), where rounds
  // are instead rendered interleaved across exercises by SupersetRounds so
  // e.g. squat's round 1 sits next to deadlift's round 1, matching how the
  // exercises are actually performed back-to-back.
  showRounds?: boolean;
  // The round number that's "up next" for this exercise, or null if it's
  // not this exercise's turn (or the workout isn't in progress).
  currentRound: number | null;
}) {
  const { exercise } = workoutExercise;

  return (
    <li className="flex flex-col gap-2 p-2 text-sm">
      <div className="flex items-center justify-between gap-4">
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
      </div>

      {disabled ? (
        workoutExercise.noteForNextTime && (
          <p className="text-muted-foreground text-xs">
            Note: {workoutExercise.noteForNextTime}
          </p>
        )
      ) : (
        <ExerciseNoteForm
          sessionId={sessionId}
          workoutExerciseId={workoutExercise.id}
          initialNote={workoutExercise.noteForNextTime}
        />
      )}

      {showRounds && (
        <RoundSets
          sessionId={sessionId}
          workoutExerciseId={workoutExercise.id}
          setType={exercise.defaultSetType}
          roundCount={roundCount}
          sets={workoutExercise.sets}
          target={
            exercise.defaultSetType === "REPS"
              ? workoutExercise.targetReps
              : exercise.defaultSetType === "DURATION"
                ? workoutExercise.targetDurationSeconds
                : workoutExercise.targetDistanceMeters
          }
          defaultWeightUnit={defaultWeightUnit}
          disabled={disabled}
          currentRound={currentRound}
        />
      )}
    </li>
  );
}
