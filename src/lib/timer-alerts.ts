"use client";

import { useEffect, useRef } from "react";

// v1 scope (PRD 7.5): alerts only need to work while the app is open in the
// foreground with the screen on, so every API here is best-effort and
// feature-detected - a browser that lacks or denies one of these just loses
// that specific alert channel instead of breaking the timer.

// A single AudioContext, reused for every alert rather than created fresh
// each time. Browsers only let an AudioContext produce sound once it's been
// created/resumed inside a real user gesture (click/tap) - a timer's
// completion callback fires from a setInterval or a visibilitychange
// handler, neither of which counts, so a context created there is born
// "suspended" and its sound is silently dropped. Reusing one context that
// gets unlocked elsewhere (see unlockAlertAudio below) sidesteps that.
let sharedAudioContext: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (sharedAudioContext) return sharedAudioContext;
  const AudioContextClass =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!AudioContextClass) return null;
  try {
    sharedAudioContext = new AudioContextClass();
    return sharedAudioContext;
  } catch {
    return null;
  }
}

// Call this from an actual click/tap handler (anywhere in the app, not
// necessarily timer-related) to unlock the shared AudioContext well before
// any timer alert needs to play through it.
export function unlockAlertAudio() {
  const ctx = getAudioContext();
  if (ctx?.state === "suspended") {
    ctx.resume().catch(() => {
      // still locked - the alert will just stay silent this session
    });
  }
}

export function playAlertSound() {
  const ctx = getAudioContext();
  if (!ctx) return;
  try {
    if (ctx.state === "suspended") {
      ctx.resume().catch(() => {});
    }
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.frequency.value = 880;
    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    oscillator.start();
    oscillator.stop(ctx.currentTime + 0.3);
  } catch {
    // sound is a nice-to-have, not required
  }
}

export function vibrateAlert() {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    try {
      navigator.vibrate([200, 100, 200]);
    } catch {
      // vibration is a nice-to-have, not required
    }
  }
}

export async function requestNotificationPermission() {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  try {
    if (Notification.permission === "default") {
      await Notification.requestPermission();
    }
  } catch {
    // ignore - fall back to sound/vibration only
  }
}

export function notifyTimerDone(title: string) {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  try {
    if (Notification.permission === "granted") {
      new Notification(title);
    }
  } catch {
    // ignore - fall back to sound/vibration only
  }
}

export function alertTimerDone(title = "Time's up!") {
  playAlertSound();
  vibrateAlert();
  notifyTimerDone(title);
}

export async function requestWakeLock(): Promise<WakeLockSentinel | null> {
  if (typeof navigator === "undefined" || !("wakeLock" in navigator)) {
    return null;
  }
  try {
    return await navigator.wakeLock.request("screen");
  } catch {
    // wake lock requires a visible page/secure context - not fatal
    return null;
  }
}

export function releaseWakeLock(lock: WakeLockSentinel | null) {
  if (!lock) return;
  try {
    lock.release();
  } catch {
    // already released or unsupported - ignore
  }
}

// Holds the screen-wake lock for as long as `active` is true. The browser
// auto-releases a wake lock whenever the tab is hidden (switching apps,
// locking the screen mid-timer) and never reacquires it on its own, so this
// re-requests it on visibilitychange - otherwise the screen could go back to
// sleeping a few seconds after the user returns to a still-running timer.
export function useWakeLock(active: boolean) {
  const lockRef = useRef<WakeLockSentinel | null>(null);

  useEffect(() => {
    if (!active) return;

    let cancelled = false;
    requestWakeLock().then((lock) => {
      if (cancelled) {
        releaseWakeLock(lock);
        return;
      }
      lockRef.current = lock;
    });

    const onVisible = () => {
      if (document.visibilityState !== "visible" || lockRef.current) return;
      requestWakeLock().then((lock) => {
        if (!cancelled) lockRef.current = lock;
      });
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
      releaseWakeLock(lockRef.current);
      lockRef.current = null;
    };
  }, [active]);
}
