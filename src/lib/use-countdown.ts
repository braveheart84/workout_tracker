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

  // Wall-clock deadline rather than a per-tick decrement, so backgrounding
  // the tab (which browsers throttle or fully suspend setInterval for)
  // can't make the countdown drift - the instant the tab is foregrounded
  // again, the next tick recomputes from Date.now() and snaps to the
  // correct value (firing completion immediately if time already ran out
  // while backgrounded) instead of resuming from a stale count.
  const deadlineRef = useRef(0);
  const remainingAtPauseRef = useRef(totalSeconds);

  const tick = useCallback(() => {
    const remaining = Math.max(
      0,
      Math.ceil((deadlineRef.current - Date.now()) / 1000),
    );
    setSecondsLeft(remaining);
    if (remaining <= 0) {
      setStatus((s) => {
        if (s !== "running") return s;
        onCompleteRef.current(totalSeconds);
        return "done";
      });
    }
  }, [totalSeconds]);

  useEffect(() => {
    if (status !== "running") return;
    tick();
    const interval = setInterval(tick, 1000);
    const onVisible = () => {
      if (document.visibilityState === "visible") tick();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [status, tick]);

  const start = useCallback(() => {
    deadlineRef.current = Date.now() + totalSeconds * 1000;
    setSecondsLeft(totalSeconds);
    setStatus("running");
  }, [totalSeconds]);

  const pause = useCallback(() => {
    remainingAtPauseRef.current = Math.max(
      0,
      Math.ceil((deadlineRef.current - Date.now()) / 1000),
    );
    setStatus("paused");
  }, []);

  const resume = useCallback(() => {
    deadlineRef.current = Date.now() + remainingAtPauseRef.current * 1000;
    setStatus("running");
  }, []);

  const skip = useCallback(() => {
    const remaining = Math.max(
      0,
      Math.ceil((deadlineRef.current - Date.now()) / 1000),
    );
    setStatus("done");
    setSecondsLeft(0);
    onCompleteRef.current(totalSeconds - remaining);
  }, [totalSeconds]);

  const reset = useCallback(() => {
    setSecondsLeft(totalSeconds);
    setStatus("idle");
  }, [totalSeconds]);

  return { secondsLeft, status, start, pause, resume, skip, reset };
}
