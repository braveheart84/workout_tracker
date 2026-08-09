"use client";

// v1 scope (PRD 7.5): alerts only need to work while the app is open in the
// foreground with the screen on, so every API here is best-effort and
// feature-detected - a browser that lacks or denies one of these just loses
// that specific alert channel instead of breaking the timer.

export function playAlertSound() {
  if (typeof window === "undefined") return;
  try {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.frequency.value = 880;
    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    oscillator.start();
    oscillator.stop(ctx.currentTime + 0.3);
    oscillator.onended = () => ctx.close();
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
