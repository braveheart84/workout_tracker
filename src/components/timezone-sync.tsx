"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { TIMEZONE_COOKIE_NAME } from "@/lib/timezone-cookie";

const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

function readCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

// The server has no way to know the user's timezone on its own - this sets
// a `tz` cookie from the browser's Intl-detected zone on every page load,
// and refreshes the current route if it just changed (first-ever visit, or
// the user traveled) so date-sensitive pages like the dashboard reflect the
// user's actual local day instead of the server's. Mounted once in the
// root layout so it runs on every page without every route needing to
// remember to include it.
export function TimezoneSync() {
  const router = useRouter();

  useEffect(() => {
    let detected: string;
    try {
      detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {
      return;
    }
    if (!detected || detected === readCookie(TIMEZONE_COOKIE_NAME)) {
      return;
    }

    document.cookie = `${TIMEZONE_COOKIE_NAME}=${encodeURIComponent(detected)}; path=/; max-age=${COOKIE_MAX_AGE_SECONDS}; samesite=lax`;
    router.refresh();
  }, [router]);

  return null;
}
