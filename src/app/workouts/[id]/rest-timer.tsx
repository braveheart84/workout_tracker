"use client";

import { useEffect } from "react";
import { useCountdown } from "@/lib/use-countdown";
import { formatTime } from "@/lib/format-time";
import {
  alertTimerDone,
  requestNotificationPermission,
  useWakeLock,
} from "@/lib/timer-alerts";
import { FloatingTimerBar } from "./floating-timer-bar";

export function RestTimer({
  restSeconds,
  onDismiss,
}: {
  restSeconds: number;
  onDismiss: () => void;
}) {
  const { secondsLeft, status, start, pause, resume, skip } = useCountdown(
    restSeconds,
    () => alertTimerDone("Rest over!"),
  );

  useWakeLock(status === "running" || status === "paused");

  useEffect(() => {
    start();
    requestNotificationPermission();
  }, [start]);

  return (
    <FloatingTimerBar>
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
    </FloatingTimerBar>
  );
}
