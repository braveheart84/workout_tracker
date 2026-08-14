import type {
  Exercise,
  Set as WorkoutSet,
  WeightUnit,
} from "@/generated/prisma/client";
import { SetRow } from "./set-row";
import { AddSetForm } from "./add-set-form";
import { DurationLogging } from "./duration-logging";
import type { CurrentPosition } from "./blocks-manager";
import { formatTarget } from "@/lib/format-set-summary";

// Renders a superset block's rounds grouped by round number rather than by
// exercise, so e.g. squat's round 1 and deadlift's round 1 sit next to each
// other - matching how the exercises are actually performed back-to-back,
// with the whole round's rest coming only after every exercise in it.
export function SupersetRounds({
  sessionId,
  roundCount,
  exercises,
  defaultWeightUnit,
  disabled,
  current,
}: {
  sessionId: string;
  roundCount: number;
  exercises: {
    id: string;
    targetReps: number | null;
    targetDurationSeconds: number | null;
    targetDistanceMeters: number | null;
    exercise: Exercise;
    sets: WorkoutSet[];
  }[];
  defaultWeightUnit: WeightUnit;
  disabled: boolean;
  current: CurrentPosition | null;
}) {
  const rounds = Array.from({ length: roundCount }, (_, i) => i + 1);

  return (
    <div className="space-y-3 text-xs">
      {rounds.map((round) => (
        <div
          key={round}
          className="space-y-2 border-t pt-3 first:border-t-0 first:pt-0"
        >
          <p className="text-muted-foreground font-medium">Round {round}</p>
          <div className="divide-border space-y-2 divide-y">
            {exercises.map((we) => {
              const setType = we.exercise.defaultSetType;
              const target =
                setType === "REPS"
                  ? we.targetReps
                  : setType === "DURATION"
                    ? we.targetDurationSeconds
                    : we.targetDistanceMeters;
              const roundSets = we.sets
                .filter((s) => s.roundNumber === round)
                .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
              const isCurrent =
                current?.workoutExerciseId === we.id && current.round === round;
              // Round 1's last logged set for this exercise, used to
              // pre-fill rounds 2+ so the user isn't retyping the same
              // reps/weight (and weight unit) every round.
              const round1Sets = we.sets
                .filter((s) => s.roundNumber === 1)
                .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
              const round1Defaults = round1Sets[round1Sets.length - 1];

              return (
                <div
                  key={we.id}
                  className={
                    isCurrent
                      ? "ring-primary/50 space-y-1 rounded-md p-2 ring-2"
                      : "space-y-1 pt-2 first:pt-0"
                  }
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-lg font-semibold">{we.exercise.name}</p>
                    {isCurrent && (
                      <span className="bg-primary text-primary-foreground shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap">
                        Up next
                      </span>
                    )}
                  </div>
                  {roundSets.length > 0 && (
                    <ul className="space-y-1">
                      {roundSets.map((set) => (
                        <SetRow
                          key={set.id}
                          sessionId={sessionId}
                          set={set}
                          setType={setType}
                          target={target}
                          disabled={disabled}
                        />
                      ))}
                    </ul>
                  )}
                  {disabled && roundSets.length === 0 && target != null && (
                    <p>Target: {formatTarget(setType, target)}</p>
                  )}
                  {!disabled && setType === "DURATION" && (
                    <DurationLogging
                      // Remounts (picking up a fresh defaultValue) if
                      // round 1 gets logged/edited after this round
                      // already rendered - defaultValue only applies at
                      // mount otherwise.
                      key={round > 1 ? (round1Defaults?.id ?? "none") : "self"}
                      sessionId={sessionId}
                      workoutExerciseId={we.id}
                      roundNumber={round}
                      target={target}
                      defaultWeightUnit={defaultWeightUnit}
                      hasLoggedSets={roundSets.length > 0}
                      defaults={round > 1 ? round1Defaults : undefined}
                    />
                  )}
                  {!disabled && setType !== "DURATION" && (
                    <AddSetForm
                      key={round > 1 ? (round1Defaults?.id ?? "none") : "self"}
                      sessionId={sessionId}
                      workoutExerciseId={we.id}
                      roundNumber={round}
                      setType={setType}
                      target={target}
                      defaultWeightUnit={defaultWeightUnit}
                      hasLoggedSets={roundSets.length > 0}
                      defaults={round > 1 ? round1Defaults : undefined}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
