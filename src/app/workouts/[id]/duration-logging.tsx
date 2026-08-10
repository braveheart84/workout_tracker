"use client";

import { useState } from "react";
import type { WeightUnit } from "@/generated/prisma/client";
import { AddSetForm } from "./add-set-form";
import { DurationTimer } from "./duration-timer";

export function DurationLogging({
  sessionId,
  workoutExerciseId,
  roundNumber,
  defaultWeightUnit,
}: {
  sessionId: string;
  workoutExerciseId: string;
  roundNumber: number;
  defaultWeightUnit: WeightUnit;
}) {
  const [showManual, setShowManual] = useState(false);

  return (
    <div className="space-y-1">
      <DurationTimer
        sessionId={sessionId}
        workoutExerciseId={workoutExerciseId}
        roundNumber={roundNumber}
        defaultWeightUnit={defaultWeightUnit}
      />
      {showManual ? (
        <AddSetForm
          sessionId={sessionId}
          workoutExerciseId={workoutExerciseId}
          roundNumber={roundNumber}
          setType="DURATION"
          defaultWeightUnit={defaultWeightUnit}
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
