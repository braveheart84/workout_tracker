"use client";

import { useEffect, useState } from "react";
import type { WeightUnit } from "@/generated/prisma/client";
import { addSetAction } from "./set-actions";
import { useCountdown } from "@/lib/use-countdown";
import { formatTime } from "@/lib/format-time";
import {
  alertTimerDone,
  requestNotificationPermission,
  useWakeLock,
} from "@/lib/timer-alerts";
import { FloatingTimerBar } from "./floating-timer-bar";

type PendingLog = {
  elapsedSeconds: number;
  weight: string;
  weightUnit: WeightUnit;
};

export function DurationTimer({
  sessionId,
  workoutExerciseId,
  roundNumber,
  defaultWeightUnit,
  defaults,
}: {
  sessionId: string;
  workoutExerciseId: string;
  roundNumber: number;
  defaultWeightUnit: WeightUnit;
  // Round 1's logged values for this exercise, if any - pre-fills rounds
  // 2+ so the user isn't retyping the same duration/weight every round.
  defaults?: {
    weight: number | null;
    weightUnit: WeightUnit | null;
    durationSeconds: number | null;
  };
}) {
  const [targetSeconds, setTargetSeconds] = useState(
    defaults?.durationSeconds ?? 60,
  );
  const [weight, setWeight] = useState(defaults?.weight?.toString() ?? "");
  const [weightUnit, setWeightUnit] = useState<WeightUnit>(
    defaults?.weightUnit ?? defaultWeightUnit,
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingLog, setPendingLog] = useState<PendingLog | null>(null);

  const { secondsLeft, status, start, pause, resume, skip, reset } =
    useCountdown(targetSeconds, (elapsedSeconds) => {
      alertTimerDone();
      setPendingLog({ elapsedSeconds, weight, weightUnit });
    });

  useWakeLock(status === "running" || status === "paused");

  useEffect(() => {
    if (!pendingLog) return;
    const log = pendingLog;
    let cancelled = false;

    async function logSet() {
      setSubmitting(true);
      setError(null);

      const formData = new FormData();
      formData.set("durationSeconds", String(log.elapsedSeconds));
      if (log.weight.trim() !== "") {
        formData.set("weight", log.weight);
        formData.set("weightUnit", log.weightUnit);
      }

      const result = await addSetAction(
        sessionId,
        workoutExerciseId,
        roundNumber,
        undefined,
        formData,
      );

      if (cancelled) return;
      setSubmitting(false);
      setPendingLog(null);
      if (result?.error) {
        setError(result.error);
      } else {
        reset();
      }
    }

    logSet();
    return () => {
      cancelled = true;
    };
  }, [pendingLog, sessionId, workoutExerciseId, roundNumber, reset]);

  async function handleStart() {
    setError(null);
    await requestNotificationPermission();
    start();
  }

  if (status === "idle") {
    return (
      <div className="flex flex-wrap items-end gap-2">
        <div className="space-y-1">
          <label className="text-xs font-medium">Timer (seconds)</label>
          <input
            type="number"
            name="timerSeconds"
            min={1}
            max={36000}
            value={targetSeconds}
            onChange={(e) =>
              setTargetSeconds(Math.max(1, Number(e.target.value) || 1))
            }
            className="border-input bg-background w-20 rounded-md border px-2 py-1 text-sm"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium">Weight (optional)</label>
          <div className="flex gap-1">
            <input
              type="number"
              name="timerWeight"
              min={0}
              step={0.5}
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              className="border-input bg-background w-16 rounded-md border px-2 py-1 text-sm"
            />
            <select
              value={weightUnit}
              onChange={(e) => setWeightUnit(e.target.value as WeightUnit)}
              className="border-input bg-background rounded-md border px-1 py-1 text-sm"
            >
              <option value="KG">kg</option>
              <option value="LB">lb</option>
            </select>
          </div>
        </div>
        <button
          type="button"
          onClick={handleStart}
          className="bg-primary text-primary-foreground rounded-md px-2 py-1 text-xs font-medium"
        >
          Start Timer
        </button>
        {error && <p className="text-destructive w-full text-xs">{error}</p>}
      </div>
    );
  }

  return (
    <FloatingTimerBar>
      <p className="font-medium">Timer</p>
      <p className="text-2xl font-semibold tabular-nums">
        {formatTime(secondsLeft)}
      </p>
      <div className="flex gap-3 text-xs">
        {status === "running" && (
          <button type="button" onClick={pause} className="underline">
            Pause
          </button>
        )}
        {status === "paused" && (
          <button type="button" onClick={resume} className="underline">
            Resume
          </button>
        )}
        {status !== "done" && (
          <button type="button" onClick={skip} className="underline">
            Done early
          </button>
        )}
      </div>
      {submitting && <p className="text-muted-foreground text-xs">Logging…</p>}
      {error && <p className="text-destructive text-xs">{error}</p>}
    </FloatingTimerBar>
  );
}
