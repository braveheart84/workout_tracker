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
  defaultDateIso,
  templates,
}: {
  todayIso: string;
  maxIso: string;
  defaultDateIso: string;
  templates: { id: string; name: string; structure: WorkoutSuggestion }[];
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
  // Every version that used to be `current` before a Revise/Start Over
  // replaced it - lets the user go back to an earlier suggestion they
  // liked better, without re-generating. Page-local only (not persisted),
  // since it's just a within-this-generation-session convenience.
  const [history, setHistory] = useState<
    { suggestion: WorkoutSuggestion; date: string }[]
  >([]);
  // The one shared textbox behind both "Revise" and "Start Over" once a
  // suggestion exists - which action fires is decided by which button is
  // clicked (each specifies its own formAction), not by which of two
  // separate boxes the text sits in.
  const [feedbackText, setFeedbackText] = useState("");
  // Controlled (rather than defaultValue) so "Use Template" below can read
  // whichever date the user currently has picked, without a ref.
  const [dateValue, setDateValue] = useState(defaultDateIso);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [prevGenState, setPrevGenState] = useState(genState);
  if (genState !== prevGenState) {
    setPrevGenState(genState);
    if (genState?.suggestion && genState.date) {
      if (current) setHistory((h) => [...h, current]);
      setCurrent({ suggestion: genState.suggestion, date: genState.date });
      setFeedbackText("");
    }
  }
  const [prevReviseState, setPrevReviseState] = useState(reviseState);
  if (reviseState !== prevReviseState) {
    setPrevReviseState(reviseState);
    if (reviseState?.suggestion && reviseState.date) {
      if (current) setHistory((h) => [...h, current]);
      setCurrent({
        suggestion: reviseState.suggestion,
        date: reviseState.date,
      });
      setFeedbackText("");
    }
  }

  const suggestion = current?.suggestion;
  const suggestionDate = current?.date ?? defaultDateIso;

  // Swaps in an earlier version as the current one, keeping what's being
  // replaced around in history too - so flipping back and forth between
  // versions never loses either one.
  function restoreVersion(index: number) {
    const target = history[index];
    if (!target) return;
    setHistory((h) => {
      const rest = h.filter((_, i) => i !== index);
      return current ? [...rest, current] : rest;
    });
    setCurrent(target);
    setFeedbackText("");
  }

  return (
    <div className="space-y-4">
      {!suggestion && (
        <form action={genAction} className="space-y-3">
          <div className="space-y-1">
            <label htmlFor="date" className="text-sm font-medium">
              Which day is this for?
            </label>
            <input
              id="date"
              type="date"
              name="date"
              value={dateValue}
              onChange={(e) => setDateValue(e.target.value)}
              min={todayIso}
              max={maxIso}
              className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
            />
          </div>
          {templates.length > 0 && (
            <div className="space-y-1 rounded-md border p-3">
              <label htmlFor="templateId" className="text-sm font-medium">
                Or start from a saved template
              </label>
              <div className="flex gap-2">
                <select
                  id="templateId"
                  value={selectedTemplateId}
                  onChange={(e) => setSelectedTemplateId(e.target.value)}
                  className="border-input bg-background flex-1 rounded-md border px-3 py-2 text-sm"
                >
                  <option value="">Choose a template…</option>
                  {templates.map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  disabled={!selectedTemplateId}
                  onClick={() => {
                    const template = templates.find(
                      (t) => t.id === selectedTemplateId,
                    );
                    if (!template) return;
                    setCurrent({
                      suggestion: template.structure,
                      date: dateValue,
                    });
                    setSelectedTemplateId("");
                  }}
                  className="border-input rounded-md border px-3 py-2 text-sm font-medium whitespace-nowrap disabled:opacity-50"
                >
                  Use Template
                </button>
              </div>
            </div>
          )}
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
            {genPending ? "Generating…" : "Generate Workout"}
          </button>
        </form>
      )}

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
              <p className="text-muted-foreground text-lg">
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

          {history.length > 0 && (
            <div className="space-y-2 border-t pt-3">
              <p className="text-sm font-medium">
                Previous version{history.length === 1 ? "" : "s"} (
                {history.length})
              </p>
              <ul className="space-y-2">
                {history
                  .map((version, index) => ({ version, index }))
                  .reverse()
                  .map(({ version, index }) => {
                    const blockCount = version.suggestion.blocks.length;
                    const exerciseCount = version.suggestion.blocks.reduce(
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
                            {version.suggestion.label || "Suggested Workout"}
                          </p>
                          <p className="text-muted-foreground">
                            {blockCount} block{blockCount === 1 ? "" : "s"} ·{" "}
                            {exerciseCount} exercise
                            {exerciseCount === 1 ? "" : "s"}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => restoreVersion(index)}
                          className="shrink-0 underline"
                        >
                          View
                        </button>
                      </li>
                    );
                  })}
              </ul>
            </div>
          )}

          <form action={reviseAction} className="space-y-2 border-t pt-3">
            <input
              type="hidden"
              name="currentSuggestion"
              value={JSON.stringify(suggestion)}
            />
            <input type="hidden" name="date" value={suggestionDate} />
            <input type="hidden" name="freeText" value={feedbackText} />
            <label htmlFor="feedback" className="text-sm font-medium">
              Want to change something?
            </label>
            <textarea
              id="feedback"
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
