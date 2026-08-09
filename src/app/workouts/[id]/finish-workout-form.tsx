"use client";

import { useActionState } from "react";
import {
  finishWorkoutSessionAction,
  type FinishWorkoutFormState,
} from "../actions";

const DIFFICULTY_LABELS = [
  "Too Easy",
  "Easy",
  "About Right",
  "Hard",
  "Too Hard",
];

export function FinishWorkoutForm({ sessionId }: { sessionId: string }) {
  const boundFinish = finishWorkoutSessionAction.bind(null, sessionId);
  const [state, formAction, pending] = useActionState<
    FinishWorkoutFormState,
    FormData
  >(boundFinish, undefined);

  return (
    <form action={formAction} className="space-y-4 rounded-md border p-4">
      <h2 className="text-sm font-medium">How did it go?</h2>

      <div className="space-y-1">
        <p className="text-xs font-medium">Difficulty (optional)</p>
        <div className="flex justify-between gap-1">
          {DIFFICULTY_LABELS.map((label, index) => {
            const value = index + 1;
            return (
              <label
                key={value}
                className="flex flex-1 flex-col items-center gap-1 text-center text-xs"
              >
                <input type="radio" name="difficultyRating" value={value} />
                <span>{value}</span>
              </label>
            );
          })}
        </div>
        <div className="text-muted-foreground flex justify-between text-[10px]">
          <span>{DIFFICULTY_LABELS[0]}</span>
          <span>{DIFFICULTY_LABELS[4]}</span>
        </div>
      </div>

      <div className="space-y-1">
        <label htmlFor="difficultyNote" className="text-xs font-medium">
          Note (optional)
        </label>
        <textarea
          id="difficultyNote"
          name="difficultyNote"
          rows={2}
          maxLength={1000}
          placeholder="e.g. shoulders were the limiter, not legs"
          className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
        />
      </div>

      <div className="space-y-1">
        <label htmlFor="energyRating" className="text-xs font-medium">
          Energy, 1–10 (optional)
        </label>
        <input
          id="energyRating"
          type="number"
          name="energyRating"
          min={1}
          max={10}
          className="border-input bg-background w-20 rounded-md border px-2 py-1 text-sm"
        />
      </div>

      <div className="space-y-1">
        <label htmlFor="goalForNext" className="text-xs font-medium">
          Goal for next workout (optional)
        </label>
        <textarea
          id="goalForNext"
          name="goalForNext"
          rows={2}
          maxLength={1000}
          placeholder="e.g. push for 25kg on bench"
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
        {pending ? "Finishing…" : "Finish Workout"}
      </button>
    </form>
  );
}
