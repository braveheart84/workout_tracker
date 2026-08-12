"use client";

import { useActionState } from "react";
import {
  CARDIO_FINISHER_OPTIONS,
  CARDIO_FINISHER_LABELS,
  EQUIPMENT_OPTIONS,
  EQUIPMENT_LABELS,
  type CardioFinisherPreference,
  type Equipment,
} from "@/lib/preferences";
import { updateSettingsAction, type SettingsState } from "./actions";

export function SettingsForm({
  currentName,
  currentUnitSystem,
  currentRemindersEnabled,
  currentPreferredDurationMinutes,
  currentCardioFinisherPreference,
  currentAvailableEquipment,
  currentAvoidedExercisesNote,
}: {
  currentName: string | null;
  currentUnitSystem: "METRIC" | "IMPERIAL";
  currentRemindersEnabled: boolean;
  currentPreferredDurationMinutes: number | null;
  currentCardioFinisherPreference: CardioFinisherPreference;
  currentAvailableEquipment: Equipment[];
  currentAvoidedExercisesNote: string | null;
}) {
  const [state, formAction, pending] = useActionState<SettingsState, FormData>(
    updateSettingsAction,
    undefined,
  );

  return (
    <form action={formAction} className="space-y-6">
      <div className="space-y-1">
        <label htmlFor="name" className="text-sm font-medium">
          Name
        </label>
        <input
          id="name"
          type="text"
          name="name"
          maxLength={100}
          defaultValue={currentName ?? ""}
          placeholder="e.g. Alex"
          className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
        />
      </div>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Units</legend>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="radio"
            name="unitSystem"
            value="METRIC"
            defaultChecked={currentUnitSystem === "METRIC"}
          />
          Metric (kg, km)
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="radio"
            name="unitSystem"
            value="IMPERIAL"
            defaultChecked={currentUnitSystem === "IMPERIAL"}
          />
          Imperial (lb, mi)
        </label>
      </fieldset>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="remindersEnabled"
          value="on"
          defaultChecked={currentRemindersEnabled}
        />
        Remind me if I haven&apos;t logged a workout in a few days
      </label>

      <div className="space-y-4 border-t pt-4">
        <p className="text-sm font-medium">Workout generation preferences</p>
        <p className="text-muted-foreground text-xs">
          Set these once so you don&apos;t have to restate them every time you
          generate a workout.
        </p>

        <div className="space-y-1">
          <label htmlFor="preferredDurationMinutes" className="text-sm">
            Preferred session length (minutes, optional)
          </label>
          <input
            id="preferredDurationMinutes"
            type="number"
            name="preferredDurationMinutes"
            min={10}
            max={180}
            defaultValue={currentPreferredDurationMinutes ?? ""}
            placeholder="e.g. 45"
            className="border-input bg-background w-24 rounded-md border px-3 py-2 text-sm"
          />
        </div>

        <fieldset className="space-y-2">
          <legend className="text-sm">Cardio finisher</legend>
          {CARDIO_FINISHER_OPTIONS.map((option) => (
            <label key={option} className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="cardioFinisherPreference"
                value={option}
                defaultChecked={currentCardioFinisherPreference === option}
              />
              {CARDIO_FINISHER_LABELS[option]}
            </label>
          ))}
        </fieldset>

        <fieldset className="space-y-2">
          <legend className="text-sm">
            Available equipment (optional, pick any)
          </legend>
          {EQUIPMENT_OPTIONS.map((option) => (
            <label key={option} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="availableEquipment"
                value={option}
                defaultChecked={currentAvailableEquipment.includes(option)}
              />
              {EQUIPMENT_LABELS[option]}
            </label>
          ))}
          <p className="text-muted-foreground text-xs">
            Leave everything unchecked for no equipment preference.
          </p>
        </fieldset>

        <div className="space-y-1">
          <label htmlFor="avoidedExercisesNote" className="text-sm">
            Exercises to avoid (optional)
          </label>
          <textarea
            id="avoidedExercisesNote"
            name="avoidedExercisesNote"
            rows={2}
            maxLength={500}
            defaultValue={currentAvoidedExercisesNote ?? ""}
            placeholder="e.g. avoid overhead pressing, bad knees so no deep lunges"
            className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
          />
        </div>
      </div>

      {state?.error && (
        <p className="text-destructive text-sm">{state.error}</p>
      )}
      {state?.success && (
        <p className="text-sm text-green-600 dark:text-green-500">Saved.</p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="bg-primary text-primary-foreground w-full rounded-md px-3 py-2 text-sm font-medium disabled:opacity-50"
      >
        {pending ? "Saving…" : "Save changes"}
      </button>
    </form>
  );
}
