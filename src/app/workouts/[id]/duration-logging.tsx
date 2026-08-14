"use client";

import { useState } from "react";
import type { WeightUnit } from "@/generated/prisma/client";
import { AddSetForm } from "./add-set-form";
import { DurationTimer } from "./duration-timer";

export function DurationLogging({
  sessionId,
  workoutExerciseId,
  roundNumber,
  target,
  defaultWeightUnit,
  hasLoggedSets,
  defaults,
}: {
  sessionId: string;
  workoutExerciseId: string;
  roundNumber: number;
  target: number | null;
  defaultWeightUnit: WeightUnit;
  hasLoggedSets: boolean;
  // Round 1's logged values for this exercise, if any - pre-fills rounds
  // 2+ so the user isn't retyping the same duration/weight every round.
  defaults?: {
    reps: number | null;
    weight: number | null;
    weightUnit: WeightUnit | null;
    durationSeconds: number | null;
    distanceMeters: number | null;
  };
}) {
  const [showManual, setShowManual] = useState(false);

  return (
    <div className="space-y-1">
      <DurationTimer
        sessionId={sessionId}
        workoutExerciseId={workoutExerciseId}
        roundNumber={roundNumber}
        defaultWeightUnit={defaultWeightUnit}
        defaults={defaults}
      />
      {showManual ? (
        <AddSetForm
          sessionId={sessionId}
          workoutExerciseId={workoutExerciseId}
          roundNumber={roundNumber}
          setType="DURATION"
          target={target}
          defaultWeightUnit={defaultWeightUnit}
          hasLoggedSets={hasLoggedSets}
          defaults={defaults}
        />
      ) : (
        <button
          type="button"
          onClick={() => setShowManual(true)}
          className="text-muted-foreground underline"
        >
          Log time manually instead
        </button>
      )}
    </div>
  );
}
