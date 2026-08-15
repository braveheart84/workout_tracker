"use client";

import { useEffect } from "react";
import { unlockAlertAudio } from "@/lib/timer-alerts";

// Timer alert sounds play from a setInterval/visibilitychange callback,
// which browsers don't treat as a user gesture - an AudioContext only
// produces sound once it's been unlocked inside a real click/tap. Rather
// than trying to unlock it from the exact button that happens to start a
// given timer (fragile - the rest timer auto-starts after a Log tap in a
// different component, for instance), this listens for the very first
// tap/click anywhere in the app and unlocks it then, well before any timer
// alert is likely to fire. Mounted once in the root layout.
export function AudioUnlock() {
  useEffect(() => {
    function onFirstInteraction() {
      unlockAlertAudio();
      window.removeEventListener("pointerdown", onFirstInteraction);
      window.removeEventListener("keydown", onFirstInteraction);
    }
    window.addEventListener("pointerdown", onFirstInteraction);
    window.addEventListener("keydown", onFirstInteraction);
    return () => {
      window.removeEventListener("pointerdown", onFirstInteraction);
      window.removeEventListener("keydown", onFirstInteraction);
    };
  }, []);

  return null;
}
