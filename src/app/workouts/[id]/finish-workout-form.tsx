"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import {
  finishWorkoutSessionAction,
  type FinishWorkoutFormState,
} from "../actions";
import { DIFFICULTY_LABELS } from "@/lib/difficulty";

// How long the "Workout Complete" splash stays up before redirecting home -
// long enough to register as a deliberate confirmation, short enough not to
// feel like a delay.
const REDIRECT_DELAY_MS = 1800;

export function FinishWorkoutForm({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const boundFinish = finishWorkoutSessionAction.bind(null, sessionId);
  const [state, formAction, pending] = useActionState<
    FinishWorkoutFormState,
    FormData
  >(boundFinish, undefined);

  useEffect(() => {
    if (!state?.success) return;
    const timeout = setTimeout(() => {
      // finishWorkoutSessionAction deliberately skips revalidatePath (see
      // its own comment) so this splash isn't swapped out before it shows -
      // which means /dashboard's client-side route cache was never told
      // anything changed. router.refresh() right after push guarantees the
      // destination isn't served a stale cached copy from before this
      // workout was completed.
      router.push("/dashboard");
      router.refresh();
    }, REDIRECT_DELAY_MS);
    return () => clearTimeout(timeout);
  }, [state?.success, router]);

  if (state?.success) {
    return (
      <div className="bg-background fixed inset-0 z-50 flex flex-col items-center justify-center gap-3">
        <CheckCircle2 className="h-16 w-16 text-emerald-500" />
        <p className="text-xl font-semibold">Workout Complete!</p>
        <p className="text-muted-foreground text-sm">Nice work.</p>
      </div>
    );
  }

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
