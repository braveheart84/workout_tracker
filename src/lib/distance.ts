export type DistanceUnit = "km" | "mi";

const METERS_PER_MILE = 1609.344;

export function metersFromValue(value: number, unit: DistanceUnit): number {
  return unit === "km" ? value * 1000 : value * METERS_PER_MILE;
}

export function metersToValue(meters: number, unit: DistanceUnit): number {
  return unit === "km" ? meters / 1000 : meters / METERS_PER_MILE;
}

export function formatDistance(meters: number, unit: DistanceUnit): string {
  return `${metersToValue(meters, unit).toFixed(2)} ${unit}`;
}

// Average pace over the whole run - deliberately derived from
// distance/duration rather than stored, so it can never drift out of sync
// with them (e.g. if either is corrected after extraction).
export function formatPace(
  durationSeconds: number,
  meters: number,
  unit: DistanceUnit,
): string | null {
  const distanceInUnit = metersToValue(meters, unit);
  if (distanceInUnit <= 0) return null;
  const secondsPerUnit = durationSeconds / distanceInUnit;
  const minutes = Math.floor(secondsPerUnit / 60);
  const seconds = Math.round(secondsPerUnit % 60);
  return `${minutes}:${String(seconds).padStart(2, "0")}/${unit}`;
}

// Runs commonly exceed an hour, unlike the app's other timers (rest/duration
// logging, formatTime in format-time.ts) which top out around a few minutes -
// so this carries hours explicitly rather than folding them into an
// ever-growing minutes count.
export function formatDurationHms(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

// Accepts "H:MM:SS", "M:SS", or a bare number of seconds - whatever a user
// might type in after reading it off a run-tracking app. Returns null for
// anything that doesn't parse rather than throwing, so the caller can
// surface a plain validation message.
export function parseDurationToSeconds(input: string): number | null {
  const trimmed = input.trim();
  if (trimmed === "") return null;

  if (/^\d+$/.test(trimmed)) {
    return Number(trimmed);
  }

  const parts = trimmed.split(":");
  if (parts.length < 2 || parts.length > 3 || !parts.every((p) => /^\d+$/.test(p))) {
    return null;
  }
  const numbers = parts.map(Number);
  const [hours, minutes, seconds] =
    numbers.length === 3 ? numbers : [0, numbers[0], numbers[1]];
  if (minutes >= 60 || seconds >= 60) return null;

  return hours * 3600 + minutes * 60 + seconds;
}
