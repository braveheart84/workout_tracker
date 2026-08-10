import type {
  Set as WorkoutSet,
  SetType,
  WeightUnit,
} from "@/generated/prisma/client";
import { SetRow } from "./set-row";
import { AddSetForm } from "./add-set-form";
import { DurationLogging } from "./duration-logging";

export function RoundSets({
  sessionId,
  workoutExerciseId,
  setType,
  roundCount,
  sets,
  target,
  defaultWeightUnit,
  disabled,
  currentRound,
}: {
  sessionId: string;
  workoutExerciseId: string;
  setType: SetType;
  roundCount: number;
  sets: WorkoutSet[];
  target: number | null;
  defaultWeightUnit: WeightUnit;
  disabled: boolean;
  currentRound: number | null;
}) {
  const rounds = Array.from({ length: roundCount }, (_, i) => i + 1);

  return (
    <div className="bg-muted/30 space-y-2 rounded-md p-2 text-xs">
      {rounds.map((round) => {
        const roundSets = sets
          .filter((s) => s.roundNumber === round)
          .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
        const isCurrent = currentRound === round;

        return (
          <div
            key={round}
            className={
              isCurrent
                ? "ring-primary/50 space-y-1 rounded-md p-1 ring-2"
                : "space-y-1"
            }
          >
            <p className="text-muted-foreground font-medium">
              Round {round}
              {isCurrent && (
                <span className="bg-primary text-primary-foreground ml-2 rounded-full px-2 py-0.5 text-[10px] font-semibold">
                  Up next
                </span>
              )}
            </p>
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
            {!disabled && setType === "DURATION" && (
              <DurationLogging
                sessionId={sessionId}
                workoutExerciseId={workoutExerciseId}
                roundNumber={round}
                target={target}
                defaultWeightUnit={defaultWeightUnit}
                hasLoggedSets={roundSets.length > 0}
              />
            )}
            {!disabled && setType !== "DURATION" && (
              <AddSetForm
                sessionId={sessionId}
                workoutExerciseId={workoutExerciseId}
                roundNumber={round}
                setType={setType}
                target={target}
                defaultWeightUnit={defaultWeightUnit}
                hasLoggedSets={roundSets.length > 0}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
