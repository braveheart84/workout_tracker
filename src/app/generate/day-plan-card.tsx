"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { formatSetSummary } from "@/lib/format-set-summary";
import type { WorkoutSuggestion } from "@/lib/workout-suggestion-schema";
import {
  generateWorkoutSuggestionAction,
  reviseWorkoutSuggestionAction,
  acceptDayInPlanAction,
  type GenerateFormState,
  type AcceptDayFormState,
} from "./actions";

// One day's review card within a multi-day plan (PR-16). Reuses the same
// single-day actions as GenerateForm for regenerate and revise - only
// accept differs, since it needs to tag the created session with the
// shared planId instead of redirecting away immediately (other days in the
// batch may still be under review).
export function DayPlanCard({
  planId,
  dateIso,
  dateLabel,
  initialSuggestion,
}: {
  planId: string;
  dateIso: string;
  dateLabel: string;
  initialSuggestion: WorkoutSuggestion;
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
    AcceptDayFormState,
    FormData
  >(acceptDayInPlanAction, undefined);

  const [current, setCurrent] = useState<WorkoutSuggestion>(initialSuggestion);
  // The one shared textbox behind both "Revise" and "Start Over" - which
  // action fires is decided by which button is clicked (each specifies its
  // own formAction), not by which of two separate boxes the text sits in.
  const [feedbackText, setFeedbackText] = useState("");
  const [prevGenState, setPrevGenState] = useState(genState);
  if (genState !== prevGenState) {
    setPrevGenState(genState);
    if (genState?.suggestion) {
      setCurrent(genState.suggestion);
      setFeedbackText("");
    }
  }
  const [prevReviseState, setPrevReviseState] = useState(reviseState);
  if (reviseState !== prevReviseState) {
    setPrevReviseState(reviseState);
    if (reviseState?.suggestion) {
      setCurrent(reviseState.suggestion);
      setFeedbackText("");
    }
  }

  const accepted = Boolean(acceptState?.sessionId);

  return (
    <div className="space-y-3 rounded-md border p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-sm font-medium">
            {current.label || "Suggested Workout"}
          </h3>
          <p className="text-muted-foreground text-xs">{dateLabel}</p>
          {current.rationale && (
            <p className="text-muted-foreground text-xs">{current.rationale}</p>
          )}
        </div>
        {accepted && acceptState?.sessionId && (
          <Link
            href={`/workouts/${acceptState.sessionId}`}
            className="shrink-0 text-xs underline"
          >
            View
          </Link>
        )}
      </div>

      <ul className="space-y-3">
        {current.blocks.map((block, blockIndex) => (
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

      {accepted ? (
        <p className="text-muted-foreground text-xs">
          Accepted — added to your plan.
        </p>
      ) : (
        <>
          <form action={reviseAction} className="space-y-2 border-t pt-3">
            <input
              type="hidden"
              name="currentSuggestion"
              value={JSON.stringify(current)}
            />
            <input type="hidden" name="date" value={dateIso} />
            <input type="hidden" name="freeText" value={feedbackText} />
            <label className="text-sm font-medium">
              Want to change something?
            </label>
            <textarea
              name="feedback"
              value={feedbackText}
              onChange={(e) => setFeedbackText(e.target.value)}
              rows={2}
              maxLength={1000}
              placeholder="e.g. swap burpees for mountain climbers — or leave blank and start over completely"
              className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
            />
            {(genState?.error || reviseState?.error) && (
              <p className="text-destructive text-sm">
                {genState?.error || reviseState?.error}
              </p>
            )}
            <div className="flex gap-2">
              <button
                type="submit"
                formAction={reviseAction}
                disabled={genPending || revisePending}
                className="border-input flex-1 rounded-md border px-3 py-2 text-sm font-medium disabled:opacity-50"
              >
                {revisePending ? "Revising…" : "Revise"}
              </button>
              <button
                type="submit"
                formAction={genAction}
                disabled={genPending || revisePending}
                className="border-input flex-1 rounded-md border px-3 py-2 text-sm font-medium disabled:opacity-50"
              >
                {genPending ? "Regenerating…" : "Start Over"}
              </button>
            </div>
          </form>

          <form action={acceptAction} className="border-t pt-3">
            <input
              type="hidden"
              name="suggestion"
              value={JSON.stringify(current)}
            />
            <input type="hidden" name="date" value={dateIso} />
            <input type="hidden" name="planId" value={planId} />
            {acceptState?.error && (
              <p className="text-destructive text-sm">{acceptState.error}</p>
            )}
            <button
              type="submit"
              disabled={acceptPending}
              className="bg-primary text-primary-foreground w-full rounded-md px-3 py-2 text-sm font-medium disabled:opacity-50"
            >
              {acceptPending ? "Saving…" : "Accept & Plan This Day"}
            </button>
          </form>
        </>
      )}
    </div>
  );
}
