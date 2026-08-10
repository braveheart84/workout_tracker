"use client";

import { useActionState } from "react";
import { formatSetSummary } from "@/lib/format-set-summary";
import {
  generateWorkoutSuggestionAction,
  acceptWorkoutSuggestionAction,
  type GenerateFormState,
  type AcceptFormState,
} from "./actions";

export function GenerateForm() {
  const [state, formAction, pending] = useActionState<
    GenerateFormState,
    FormData
  >(generateWorkoutSuggestionAction, undefined);
  const [acceptState, acceptAction, acceptPending] = useActionState<
    AcceptFormState,
    FormData
  >(acceptWorkoutSuggestionAction, undefined);

  const suggestion = state?.suggestion;

  return (
    <div className="space-y-4">
      <form action={formAction} className="space-y-3">
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
        {state?.error && (
          <p className="text-destructive text-sm">{state.error}</p>
        )}
        <button
          type="submit"
          disabled={pending}
          className="bg-primary text-primary-foreground w-full rounded-md px-3 py-2 text-sm font-medium disabled:opacity-50"
        >
          {pending
            ? "Generating…"
            : suggestion
              ? "Regenerate"
              : "Generate Workout"}
        </button>
      </form>

      {suggestion && (
        <div className="space-y-3 rounded-md border p-4">
          <div>
            <h2 className="text-sm font-medium">
              {suggestion.label || "Suggested Workout"}
            </h2>
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

          <form action={acceptAction}>
            <input
              type="hidden"
              name="suggestion"
              value={JSON.stringify(suggestion)}
            />
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
