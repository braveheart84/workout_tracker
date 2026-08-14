"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { formatSetSummary } from "@/lib/format-set-summary";
import type { WorkoutSuggestion } from "@/lib/workout-suggestion-schema";

// Shared by GenerateForm and DayPlanCard, both of which track a page-local
// history of suggestions replaced by Revise/Start Over. Tapping "View" opens
// a bottom-sheet preview (same overlay pattern as bottom-nav's "More" menu)
// rather than reverting immediately, so looking at a past version is
// non-destructive - reverting is a separate, explicit choice inside it.
export function SuggestionHistory({
  history,
  onRestore,
}: {
  history: WorkoutSuggestion[];
  onRestore: (index: number) => void;
}) {
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const previewVersion = previewIndex != null ? history[previewIndex] : null;

  // Locks background scroll while the dialog is open - without this, a
  // touch/wheel scroll starting on the sheet (most noticeable when its
  // content is short and there's nowhere left for it to scroll internally)
  // chains through to the page behind, since position:fixed alone doesn't
  // stop that on mobile.
  useEffect(() => {
    if (previewIndex === null) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [previewIndex]);

  if (history.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2 border-t pt-3">
      <p className="text-sm font-medium">
        Previous version{history.length === 1 ? "" : "s"} ({history.length})
      </p>
      <ul className="space-y-2">
        {history
          .map((version, index) => ({ version, index }))
          .reverse()
          .map(({ version, index }) => {
            const blockCount = version.blocks.length;
            const exerciseCount = version.blocks.reduce(
              (sum, b) => sum + b.exercises.length,
              0,
            );
            return (
              <li
                key={index}
                className="flex items-center justify-between gap-2 rounded-md border p-2 text-xs"
              >
                <div>
                  <p className="font-medium">
                    {version.label || "Suggested Workout"}
                  </p>
                  <p className="text-muted-foreground">
                    {blockCount} block{blockCount === 1 ? "" : "s"} ·{" "}
                    {exerciseCount} exercise{exerciseCount === 1 ? "" : "s"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setPreviewIndex(index)}
                  className="shrink-0 underline"
                >
                  View
                </button>
              </li>
            );
          })}
      </ul>

      {previewVersion && previewIndex != null && (
        <div className="fixed inset-0 z-50">
          <button
            type="button"
            aria-label="Close preview"
            onClick={() => setPreviewIndex(null)}
            className="absolute inset-0 bg-black/40"
          />
          <div className="bg-card absolute inset-x-0 bottom-0 max-h-[80vh] space-y-3 overflow-y-auto overscroll-contain rounded-t-2xl border-t p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">Previous version</p>
              <button
                type="button"
                onClick={() => setPreviewIndex(null)}
                aria-label="Close preview"
              >
                <X size={18} />
              </button>
            </div>

            <div>
              <h3 className="text-sm font-medium">
                {previewVersion.label || "Suggested Workout"}
              </h3>
              {previewVersion.rationale && (
                <p className="text-muted-foreground text-sm">
                  {previewVersion.rationale}
                </p>
              )}
            </div>

            <ul className="space-y-3">
              {previewVersion.blocks.map((block, blockIndex) => (
                <li
                  key={blockIndex}
                  className="space-y-1 rounded-md border p-3 text-sm"
                >
                  <p className="font-medium">
                    {block.roundCount} round{block.roundCount === 1 ? "" : "s"}
                    {block.restSeconds ? `, ${block.restSeconds}s rest` : ""}
                  </p>
                  <ul className="space-y-1 text-xs">
                    {block.exercises.map((exercise, exerciseIndex) => (
                      <li key={exerciseIndex}>
                        {exercise.name}
                        {exercise.muscleGroup
                          ? ` (${exercise.muscleGroup})`
                          : ""}
                        {" — "}
                        {formatSetSummary(exercise.suggestedSet)}
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPreviewIndex(null)}
                className="border-input flex-1 rounded-md border px-3 py-2 text-sm font-medium"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  onRestore(previewIndex);
                  setPreviewIndex(null);
                }}
                className="bg-primary text-primary-foreground flex-1 rounded-md px-3 py-2 text-sm font-medium"
              >
                Revert to This Version
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
