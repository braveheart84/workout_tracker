"use client";

import { useActionState, useState } from "react";
import {
  saveSessionAsTemplateAction,
  type SaveAsTemplateFormState,
} from "@/app/templates/actions";

// PRD 7.2: "from any accepted or completed session, the user can 'Save as
// Template'." Collapsed behind a toggle rather than always showing the
// name field, matching ExerciseRow's edit-toggle convention - most visits
// to a workout's page aren't about saving it as a template.
export function SaveAsTemplateForm({ sessionId }: { sessionId: string }) {
  const [open, setOpen] = useState(false);
  const boundSave = saveSessionAsTemplateAction.bind(null, sessionId);
  const [state, formAction, pending] = useActionState<
    SaveAsTemplateFormState,
    FormData
  >(boundSave, undefined);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="border-input w-full rounded-md border px-3 py-2 text-sm font-medium"
      >
        Save as Template
      </button>
    );
  }

  return (
    <form action={formAction} className="space-y-2 rounded-md border p-3">
      <label htmlFor="templateName" className="text-sm font-medium">
        Template name
      </label>
      <input
        id="templateName"
        name="name"
        maxLength={100}
        placeholder="e.g. Lower Body A"
        className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
      />
      {state?.error && (
        <p className="text-destructive text-sm">{state.error}</p>
      )}
      {state?.success && (
        <p className="text-sm text-green-600">Saved as a template.</p>
      )}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="bg-primary text-primary-foreground flex-1 rounded-md px-3 py-2 text-sm font-medium disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="border-input rounded-md border px-3 py-2 text-sm font-medium"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
