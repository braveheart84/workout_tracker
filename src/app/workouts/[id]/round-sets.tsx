import type {
  Set as WorkoutSet,
  SetType,
  WeightUnit,
} from "@/generated/prisma/client";
import { SetRow } from "./set-row";
import { AddSetForm } from "./add-set-form";
import { DurationLogging } from "./duration-logging";
import { formatTarget } from "@/lib/format-set-summary";

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

  // Round 1's last logged set, used to pre-fill rounds 2+ so the user
  // isn't retyping the same reps/weight (and weight unit) every round.
  const round1Sets = sets
    .filter((s) => s.roundNumber === 1)
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  const round1Defaults = round1Sets[round1Sets.length - 1];

  return (
    <div className="space-y-3 text-xs">
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
                ? "ring-primary/50 space-y-1 rounded-md p-2 ring-2"
                : "space-y-1 border-t pt-3 first:border-t-0 first:pt-0"
            }
          >
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-muted-foreground font-medium">Round {round}</p>
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
                // Remounts (picking up a fresh defaultValue) if round 1
                // gets logged/edited after this round already rendered -
                // defaultValue only applies at mount otherwise.
                key={round > 1 ? (round1Defaults?.id ?? "none") : "self"}
                sessionId={sessionId}
                workoutExerciseId={workoutExerciseId}
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
                workoutExerciseId={workoutExerciseId}
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
  );
}
