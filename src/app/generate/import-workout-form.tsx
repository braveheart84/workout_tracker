"use client";

import { useActionState, useState } from "react";
import { formatSetSummary } from "@/lib/format-set-summary";
import type { WorkoutSuggestion } from "@/lib/workout-suggestion-schema";
import {
  importWorkoutTextAction,
  reviseWorkoutSuggestionAction,
  acceptWorkoutSuggestionAction,
  type GenerateFormState,
  type AcceptFormState,
} from "./actions";

// Paste-and-convert flow: unlike GenerateForm/DayPlanCard, "start over" here
// means re-running the conversion on the same (possibly just-edited) pasted
// text, not asking the model to freely generate something new - so the
// source textarea stays visible the whole time above the review, rather
// than folding into the same box as the revise feedback below it. Revise
// still only needs the one "want to change something" box, since re-import
// already covers the "throw this away and reconvert" case.
export function ImportWorkoutForm({
  todayIso,
  maxIso,
  defaultDateIso,
}: {
  todayIso: string;
  maxIso: string;
  defaultDateIso: string;
}) {
  const [importState, importAction, importPending] = useActionState<
    GenerateFormState,
    FormData
  >(importWorkoutTextAction, undefined);
  const [reviseState, reviseAction, revisePending] = useActionState<
    GenerateFormState,
    FormData
  >(reviseWorkoutSuggestionAction, undefined);
  const [acceptState, acceptAction, acceptPending] = useActionState<
    AcceptFormState,
    FormData
  >(acceptWorkoutSuggestionAction, undefined);

  const [current, setCurrent] = useState<{
    suggestion: WorkoutSuggestion;
    date: string;
  } | null>(null);
  const [prevImportState, setPrevImportState] = useState(importState);
  if (importState !== prevImportState) {
    setPrevImportState(importState);
    if (importState?.suggestion && importState.date) {
      setCurrent({
        suggestion: importState.suggestion,
        date: importState.date,
      });
    }
  }
  const [feedbackText, setFeedbackText] = useState("");
  const [prevReviseState, setPrevReviseState] = useState(reviseState);
  if (reviseState !== prevReviseState) {
    setPrevReviseState(reviseState);
    if (reviseState?.suggestion && reviseState.date) {
      setCurrent({
        suggestion: reviseState.suggestion,
        date: reviseState.date,
      });
      setFeedbackText("");
    }
  }

  const suggestion = current?.suggestion;
  const suggestionDate = current?.date ?? defaultDateIso;

  return (
    <div className="space-y-4">
      <form action={importAction} className="space-y-3">
        <div className="space-y-1">
          <label htmlFor="importDate" className="text-sm font-medium">
            Which day is this for?
          </label>
          <input
            id="importDate"
            type="date"
            name="date"
            defaultValue={defaultDateIso}
            min={todayIso}
            max={maxIso}
            className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="sourceText" className="text-sm font-medium">
            Paste a workout from anywhere - a coach, an app, a website
          </label>
          <textarea
            id="sourceText"
            name="sourceText"
            rows={12}
            maxLength={6000}
            placeholder={
              "e.g.\n1. Goblet Squat\n3 x 10-12\nRest 60-75 sec\n\n2. Hip Thrust\n3 x 12-15\n..."
            }
            className="border-input bg-background w-full rounded-md border px-3 py-2 font-mono text-xs"
          />
        </div>
        {importState?.error && (
          <p className="text-destructive text-sm">{importState.error}</p>
        )}
        <button
          type="submit"
          disabled={importPending}
          className="bg-primary text-primary-foreground w-full rounded-md px-3 py-2 text-sm font-medium disabled:opacity-50"
        >
          {importPending
            ? "Converting…"
            : suggestion
              ? "Re-import From Text"
              : "Import Workout"}
        </button>
      </form>

      {suggestion && (
        <div className="space-y-3 rounded-md border p-4">
          <div>
            <h2 className="text-sm font-medium">
              {suggestion.label || "Imported Workout"}
            </h2>
            <p className="text-muted-foreground text-xs">
              For{" "}
              {new Date(`${suggestionDate}T00:00:00.000Z`).toLocaleDateString(
                undefined,
                { timeZone: "UTC" },
              )}
            </p>
            {suggestion.rationale && (
              <p className="text-muted-foreground text-xs">
                {suggestion.rationale}
              </p>
            )}
          </div>
          <ul className="space-y-3">
            {suggestion.blocks.map((block, blockIndex) => (
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
                      {exercise.muscleGroup ? ` (${exercise.muscleGroup})` : ""}
                      {" — "}
                      {formatSetSummary(exercise.suggestedSet)}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>

          <form action={reviseAction} className="space-y-2 border-t pt-3">
            <input
              type="hidden"
              name="currentSuggestion"
              value={JSON.stringify(suggestion)}
            />
            <input type="hidden" name="date" value={suggestionDate} />
            <label htmlFor="importFeedback" className="text-sm font-medium">
              Want to change something?
            </label>
            <textarea
              id="importFeedback"
              name="feedback"
              value={feedbackText}
              onChange={(e) => setFeedbackText(e.target.value)}
              rows={2}
              maxLength={1000}
              placeholder="e.g. the conversion missed the core section, add it back"
              className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
            />
            {reviseState?.error && (
              <p className="text-destructive text-sm">{reviseState.error}</p>
            )}
            <button
              type="submit"
              disabled={revisePending}
              className="border-input w-full rounded-md border px-3 py-2 text-sm font-medium disabled:opacity-50"
            >
              {revisePending ? "Revising…" : "Revise"}
            </button>
          </form>

          <form action={acceptAction}>
            <input
              type="hidden"
              name="suggestion"
              value={JSON.stringify(suggestion)}
            />
            <input type="hidden" name="date" value={suggestionDate} />
            {acceptState?.error && (
              <p className="text-destructive text-sm">{acceptState.error}</p>
            )}
            <button
              type="submit"
              disabled={acceptPending}
              className="bg-primary text-primary-foreground w-full rounded-md px-3 py-2 text-sm font-medium disabled:opacity-50"
            >
              {acceptPending ? "Saving…" : "Accept & Plan Workout"}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
