// Split out from user-date.ts, which also imports next/headers's cookies()
// - that import isn't allowed in a client bundle, so TimezoneSync (a client
// component) needs to reach this constant without pulling that in too.
export const TIMEZONE_COOKIE_NAME = "tz";
