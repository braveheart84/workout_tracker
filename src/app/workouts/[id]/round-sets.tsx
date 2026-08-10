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
}: {
  sessionId: string;
  workoutExerciseId: string;
  setType: SetType;
  roundCount: number;
  sets: WorkoutSet[];
  target: number | null;
  defaultWeightUnit: WeightUnit;
  disabled: boolean;
}) {
  const rounds = Array.from({ length: roundCount }, (_, i) => i + 1);

  return (
    <div className="bg-muted/30 space-y-2 rounded-md p-2 text-xs">
      {rounds.map((round) => {
        const roundSets = sets
          .filter((s) => s.roundNumber === round)
          .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

        return (
          <div key={round} className="space-y-1">
            <p className="text-muted-foreground font-medium">Round {round}</p>
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
