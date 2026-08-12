import { cookies } from "next/headers";
import { TIMEZONE_COOKIE_NAME } from "@/lib/timezone-cookie";

export const DEFAULT_TIMEZONE = "UTC";

// The server has no built-in way to know where the user actually is -
// TimezoneSync (src/components/timezone-sync.tsx) sets this cookie
// client-side from the browser's Intl-detected zone. Falls back to UTC for
// the very first request before that cookie exists, or if it's ever
// missing/malformed (e.g. a stale/invalid value), rather than throwing.
export async function getUserTimezone(): Promise<string> {
  const store = await cookies();
  const tz = store.get(TIMEZONE_COOKIE_NAME)?.value;
  if (!tz) return DEFAULT_TIMEZONE;
  try {
    new Intl.DateTimeFormat("en-CA", { timeZone: tz });
    return tz;
  } catch {
    return DEFAULT_TIMEZONE;
  }
}

// UTC midnight of "today" as experienced in `timezone` - matches the app's
// existing convention of storing/comparing calendar days as UTC-midnight
// Date objects, just computed relative to the user's local day instead of
// the server's. E.g. for a user in Singapore (UTC+8) at 6am Thursday
// local time, `now` is still Wednesday in UTC - this returns Thursday.
export function todayInTimezone(
  timezone: string,
  now: Date = new Date(),
): Date {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const year = Number(parts.find((p) => p.type === "year")?.value);
  const month = Number(parts.find((p) => p.type === "month")?.value);
  const day = Number(parts.find((p) => p.type === "day")?.value);
  return new Date(Date.UTC(year, month - 1, day));
}
