"use client";

import { useActionState } from "react";
import { updateSettingsAction, type SettingsState } from "./actions";

export function SettingsForm({
  currentUnitSystem,
  currentRemindersEnabled,
}: {
  currentUnitSystem: "METRIC" | "IMPERIAL";
  currentRemindersEnabled: boolean;
}) {
  const [state, formAction, pending] = useActionState<SettingsState, FormData>(
    updateSettingsAction,
    undefined,
  );

  return (
    <form action={formAction} className="space-y-6">
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
