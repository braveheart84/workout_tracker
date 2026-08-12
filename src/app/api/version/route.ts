import { NextResponse } from "next/server";

// VERCEL_GIT_COMMIT_SHA is set automatically by Vercel at build and runtime
// for every deployment - no config needed. Once a new deployment replaces
// the running instance, this route starts returning the new SHA
// immediately, which is what UpdateChecker polls for. Falls back to a
// fixed string in local dev, where every request hits the same process and
// there's nothing to detect.
export async function GET() {
  const version = process.env.VERCEL_GIT_COMMIT_SHA ?? "dev";
  return NextResponse.json({ version });
}
