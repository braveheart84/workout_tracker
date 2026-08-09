"use client";

import { useEffect, useState } from "react";
import { useCountdown } from "@/lib/use-countdown";
import { formatTime } from "@/lib/format-time";
import {
  alertTimerDone,
  releaseWakeLock,
  requestNotificationPermission,
  requestWakeLock,
} from "@/lib/timer-alerts";

export function RestTimer({
  restSeconds,
  onDismiss,
}: {
  restSeconds: number;
  onDismiss: () => void;
}) {
  const [wakeLock, setWakeLock] = useState<WakeLockSentinel | null>(null);

  const { secondsLeft, status, start, pause, resume, skip } = useCountdown(
    restSeconds,
    () => {
      alertTimerDone("Rest over!");
      releaseWakeLock(wakeLock);
      setWakeLock(null);
    },
  );

  useEffect(() => {
    start();
    requestNotificationPermission();
    requestWakeLock().then(setWakeLock);
  }, [start]);

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 flex justify-center px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
      <div className="bg-background w-full max-w-lg space-y-2 rounded-md border p-4 text-sm shadow-lg">
        <p className="font-medium">Rest</p>
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
              Skip rest
            </button>
          )}
          {status === "done" && (
            <button type="button" onClick={onDismiss} className="underline">
              Dismiss
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
