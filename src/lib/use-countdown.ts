"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type CountdownStatus = "idle" | "running" | "paused" | "done";

export function useCountdown(
  totalSeconds: number,
  onComplete: (elapsedSeconds: number) => void,
) {
  const [secondsLeft, setSecondsLeft] = useState(totalSeconds);
  const [status, setStatus] = useState<CountdownStatus>("idle");
  const onCompleteRef = useRef(onComplete);
  useEffect(() => {
    onCompleteRef.current = onComplete;
  });

  useEffect(() => {
    if (status !== "running") return;
    const interval = setInterval(() => {
      setSecondsLeft((s) => {
        const next = s - 1;
        if (next <= 0) {
          setStatus("done");
          onCompleteRef.current(totalSeconds);
          return 0;
        }
        return next;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [status, totalSeconds]);

  const start = useCallback(() => {
    setSecondsLeft(totalSeconds);
    setStatus("running");
  }, [totalSeconds]);

  const pause = useCallback(() => setStatus("paused"), []);
  const resume = useCallback(() => setStatus("running"), []);

  const skip = useCallback(() => {
    setSecondsLeft((s) => {
      setStatus("done");
      onCompleteRef.current(totalSeconds - s);
      return 0;
    });
  }, [totalSeconds]);

  const reset = useCallback(() => {
    setSecondsLeft(totalSeconds);
    setStatus("idle");
  }, [totalSeconds]);

  return { secondsLeft, status, start, pause, resume, skip, reset };
}
