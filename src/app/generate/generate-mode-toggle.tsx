"use client";

import { useState } from "react";
import type { WorkoutSuggestion } from "@/lib/workout-suggestion-schema";
import { GenerateForm } from "./generate-form";
import { MultiDayGenerateForm } from "./multi-day-generate-form";
import { ImportWorkoutForm } from "./import-workout-form";

// PRD 7.2: "chooses a scope: today only, or a range of days" - plus a third
// mode, importing a workout from elsewhere rather than generating one, per
// user request. A simple client-side toggle between the three forms, no
// server round-trip needed to switch.
export function GenerateModeToggle({
  todayIso,
  maxIso,
  defaultDateIso,
  templates,
  baselineSessions,
  initialMode = "single",
}: {
  todayIso: string;
  maxIso: string;
  defaultDateIso: string;
  templates: { id: string; name: string; structure: WorkoutSuggestion }[];
  baselineSessions: { id: string; dateIso: string; label: string | null }[];
  initialMode?: "single" | "multi" | "import";
}) {
  const [mode, setMode] = useState<"single" | "multi" | "import">(initialMode);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 text-sm">
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
        <button
          type="button"
          onClick={() => setMode("import")}
          className={
            mode === "import"
              ? "font-semibold underline"
              : "text-muted-foreground underline"
          }
        >
          Paste a workout
        </button>
      </div>
      {mode === "single" ? (
        <GenerateForm
          todayIso={todayIso}
          maxIso={maxIso}
          defaultDateIso={defaultDateIso}
          templates={templates}
        />
      ) : mode === "multi" ? (
        <MultiDayGenerateForm
          todayIso={todayIso}
          baselineSessions={baselineSessions}
        />
      ) : (
        <ImportWorkoutForm
          todayIso={todayIso}
          maxIso={maxIso}
          defaultDateIso={defaultDateIso}
        />
      )}
    </div>
  );
}
