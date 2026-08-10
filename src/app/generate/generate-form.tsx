"use client";

import { useActionState, useState } from "react";
import { formatSetSummary } from "@/lib/format-set-summary";
import type { WorkoutSuggestion } from "@/lib/workout-suggestion-schema";
import {
  generateWorkoutSuggestionAction,
  reviseWorkoutSuggestionAction,
  acceptWorkoutSuggestionAction,
  type GenerateFormState,
  type AcceptFormState,
} from "./actions";

export function GenerateForm({
  todayIso,
  maxIso,
}: {
  todayIso: string;
  maxIso: string;
}) {
  const [genState, genAction, genPending] = useActionState<
    GenerateFormState,
    FormData
  >(generateWorkoutSuggestionAction, undefined);
  const [reviseState, reviseAction, revisePending] = useActionState<
    GenerateFormState,
    FormData
  >(reviseWorkoutSuggestionAction, undefined);
  const [acceptState, acceptAction, acceptPending] = useActionState<
    AcceptFormState,
    FormData
  >(acceptWorkoutSuggestionAction, undefined);

  // The suggestion currently on screen, whichever action last produced one -
  // generating fresh or revising the current one. Tracked via the "adjust
  // state during render" pattern (comparing each action's state identity
  // against what we last saw) rather than useEffect, since it's deriving
  // local UI state from whichever of two independent action results changed
  // most recently, not performing a side effect.
  const [current, setCurrent] = useState<{
    suggestion: WorkoutSuggestion;
    date: string;
  } | null>(null);
  const [prevGenState, setPrevGenState] = useState(genState);
  if (genState !== prevGenState) {
    setPrevGenState(genState);
    if (genState?.suggestion && genState.date) {
      setCurrent({ suggestion: genState.suggestion, date: genState.date });
    }
  }
  const [prevReviseState, setPrevReviseState] = useState(reviseState);
  const [reviseFormKey, setReviseFormKey] = useState(0);
  if (reviseState !== prevReviseState) {
    setPrevReviseState(reviseState);
    if (reviseState?.suggestion && reviseState.date) {
      setCurrent({
        suggestion: reviseState.suggestion,
        date: reviseState.date,
      });
      setReviseFormKey((k) => k + 1);
    }
  }

  const suggestion = current?.suggestion;
  const suggestionDate = current?.date ?? todayIso;

  return (
    <div className="space-y-4">
      <form action={genAction} className="space-y-3">
        <div className="space-y-1">
          <label htmlFor="date" className="text-sm font-medium">
            Which day is this for?
          </label>
          <input
            id="date"
            type="date"
            name="date"
            defaultValue={todayIso}
            min={todayIso}
            max={maxIso}
            className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="freeText" className="text-sm font-medium">
            How are you feeling? What do you want to work on? (optional)
          </label>
          <textarea
            id="freeText"
            name="freeText"
            rows={3}
            maxLength={1000}
            placeholder="e.g. feeling tired, want something light for legs"
            className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
          />
        </div>
        {genState?.error && (
          <p className="text-destructive text-sm">{genState.error}</p>
        )}
        <button
          type="submit"
          disabled={genPending}
          className="bg-primary text-primary-foreground w-full rounded-md px-3 py-2 text-sm font-medium disabled:opacity-50"
        >
          {genPending
            ? "Generating…"
            : suggestion
              ? "Regenerate from scratch"
              : "Generate Workout"}
        </button>
      </form>

      {suggestion && (
        <div className="space-y-3 rounded-md border p-4">
          <div>
            <h2 className="text-sm font-medium">
              {suggestion.label || "Suggested Workout"}
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

          <form
            key={reviseFormKey}
            action={reviseAction}
            className="space-y-2 border-t pt-3"
          >
            <input
              type="hidden"
              name="currentSuggestion"
              value={JSON.stringify(suggestion)}
            />
            <input type="hidden" name="date" value={suggestionDate} />
            <label htmlFor="feedback" className="text-sm font-medium">
              Want to adjust something?
            </label>
            <textarea
              id="feedback"
              name="feedback"
              rows={2}
              maxLength={1000}
              placeholder="e.g. swap burpees for mountain climbers, make the finisher easier"
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
