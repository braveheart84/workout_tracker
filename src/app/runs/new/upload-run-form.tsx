"use client";

import { useActionState, useState } from "react";
import {
  extractRunFromScreenshotAction,
  saveRunAction,
  type ExtractRunFormState,
  type SaveRunFormState,
  type RunExtraction,
} from "../actions";
import { formatDurationHms, type DistanceUnit } from "@/lib/distance";
import { DIFFICULTY_LABELS } from "@/lib/difficulty";

type Stage = "upload" | "review";

export function UploadRunForm({
  todayIso,
  defaultDistanceUnit,
}: {
  todayIso: string;
  defaultDistanceUnit: DistanceUnit;
}) {
  const [stage, setStage] = useState<Stage>("upload");
  const [extraction, setExtraction] = useState<RunExtraction | null>(null);

  const [extractState, extractFormAction, extracting] = useActionState<
    ExtractRunFormState,
    FormData
  >(extractRunFromScreenshotAction, undefined);

  // Move to the review stage the moment a new extraction succeeds - the
  // React-recommended "adjust state during render" pattern (comparing
  // against the last-seen action-state value) rather than a useEffect,
  // since a useEffect's setState would trigger an extra, avoidable render
  // pass for a change that's already known synchronously here.
  const [handledExtractState, setHandledExtractState] = useState(extractState);
  if (extractState !== handledExtractState) {
    setHandledExtractState(extractState);
    if (extractState?.success) {
      setExtraction(extractState.extraction);
      setStage("review");
    }
  }

  const [saveState, saveFormAction, saving] = useActionState<
    SaveRunFormState,
    FormData
  >(saveRunAction, undefined);

  if (stage === "upload") {
    return (
      <form action={extractFormAction} className="space-y-4 rounded-md border p-4">
        <div className="space-y-1">
          <label htmlFor="screenshot" className="text-sm font-medium">
            Screenshot
          </label>
          <p className="text-muted-foreground text-xs">
            Upload a screenshot from Garmin, Strava, Apple Fitness, or
            similar - distance, duration, heart rate, and calories are read
            automatically.
          </p>
          <input
            id="screenshot"
            name="screenshot"
            type="file"
            accept="image/*"
            required
            className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
          />
        </div>

        {extractState && !extractState.success && (
          <p className="text-destructive text-sm">{extractState.error}</p>
        )}

        <div className="flex flex-wrap gap-2">
          <button
            type="submit"
            disabled={extracting}
            className="bg-primary text-primary-foreground rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50"
          >
            {extracting ? "Reading screenshot…" : "Extract from screenshot"}
          </button>
          <button
            type="button"
            onClick={() => {
              setExtraction(null);
              setStage("review");
            }}
            className="border-input rounded-md border px-4 py-2 text-sm font-medium"
          >
            Enter manually instead
          </button>
        </div>
      </form>
    );
  }

  return (
    <form action={saveFormAction} className="space-y-4 rounded-md border p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium">
          {extraction ? "Review extracted stats" : "Enter run details"}
        </h2>
        <button
          type="button"
          onClick={() => setStage("upload")}
          className="text-xs underline"
        >
          Start over
        </button>
      </div>

      <div className="space-y-1">
        <label htmlFor="date" className="text-xs font-medium">
          Date
        </label>
        <input
          id="date"
          type="date"
          name="date"
          max={todayIso}
          defaultValue={todayIso}
          required
          className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
        />
      </div>

      <div className="flex gap-2">
        <div className="flex-1 space-y-1">
          <label htmlFor="distanceValue" className="text-xs font-medium">
            Distance
          </label>
          <input
            id="distanceValue"
            type="number"
            name="distanceValue"
            min={0.01}
            step={0.01}
            required
            defaultValue={extraction?.distanceValue ?? undefined}
            className="border-input bg-background [appearance:textfield] w-full rounded-md border px-3 py-2 text-sm [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          />
        </div>
        <div className="w-24 space-y-1">
          <label htmlFor="distanceUnit" className="text-xs font-medium">
            Unit
          </label>
          <select
            id="distanceUnit"
            name="distanceUnit"
            defaultValue={extraction?.distanceUnit ?? defaultDistanceUnit}
            className="border-input bg-background w-full rounded-md border px-2 py-2 text-sm"
          >
            <option value="km">km</option>
            <option value="mi">mi</option>
          </select>
        </div>
      </div>

      <div className="space-y-1">
        <label htmlFor="duration" className="text-xs font-medium">
          Total time (H:MM:SS or MM:SS)
        </label>
        <input
          id="duration"
          type="text"
          name="duration"
          placeholder="e.g. 1:00:29"
          required
          defaultValue={
            extraction?.durationSeconds != null
              ? formatDurationHms(extraction.durationSeconds)
              : ""
          }
          className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
        />
      </div>

      <div className="flex gap-2">
        <div className="flex-1 space-y-1">
          <label htmlFor="avgHeartRateBpm" className="text-xs font-medium">
            Avg heart rate (optional)
          </label>
          <input
            id="avgHeartRateBpm"
            type="number"
            name="avgHeartRateBpm"
            min={1}
            max={300}
            defaultValue={extraction?.avgHeartRateBpm ?? undefined}
            className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
          />
        </div>
        <div className="flex-1 space-y-1">
          <label htmlFor="calories" className="text-xs font-medium">
            Calories (optional)
          </label>
          <input
            id="calories"
            type="number"
            name="calories"
            min={1}
            defaultValue={extraction?.calories ?? undefined}
            className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
          />
        </div>
      </div>

      <div className="space-y-4 border-t pt-4">
        <h2 className="text-sm font-medium">How did it go?</h2>

        <div className="space-y-1">
          <p className="text-xs font-medium">Effort (optional)</p>
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
            How you felt (optional)
          </label>
          <textarea
            id="difficultyNote"
            name="difficultyNote"
            rows={2}
            maxLength={1000}
            placeholder="e.g. legs felt heavy the last 2km"
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
            Goal for next run (optional)
          </label>
          <textarea
            id="goalForNext"
            name="goalForNext"
            rows={2}
            maxLength={1000}
            placeholder="e.g. hold pace under 9:30/km"
            className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
          />
        </div>
      </div>

      {saveState?.error && (
        <p className="text-destructive text-sm">{saveState.error}</p>
      )}

      <button
        type="submit"
        disabled={saving}
        className="bg-primary text-primary-foreground w-full rounded-md px-3 py-2 text-sm font-medium disabled:opacity-50"
      >
        {saving ? "Saving…" : "Save Run"}
      </button>
    </form>
  );
}
