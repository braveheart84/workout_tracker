"use client";

import { useState } from "react";
import { GenerateForm } from "./generate-form";
import { MultiDayGenerateForm } from "./multi-day-generate-form";

// PRD 7.2: "chooses a scope: today only, or a range of days" - a simple
// client-side toggle between the two existing/new forms, no server
// round-trip needed to switch.
export function GenerateModeToggle({
  todayIso,
  maxIso,
}: {
  todayIso: string;
  maxIso: string;
}) {
  const [mode, setMode] = useState<"single" | "multi">("single");

  return (
    <div className="space-y-4">
      <div className="flex gap-3 text-sm">
        <button
          type="button"
          onClick={() => setMode("single")}
          className={
            mode === "single"
              ? "font-semibold underline"
              : "text-muted-foreground underline"
          }
        >
          Single day
        </button>
        <button
          type="button"
          onClick={() => setMode("multi")}
          className={
            mode === "multi"
              ? "font-semibold underline"
              : "text-muted-foreground underline"
          }
        >
          Multiple days
        </button>
      </div>
      {mode === "single" ? (
        <GenerateForm todayIso={todayIso} maxIso={maxIso} />
      ) : (
        <MultiDayGenerateForm todayIso={todayIso} />
      )}
    </div>
  );
}
