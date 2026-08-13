"use client";

import { useActionState, useState } from "react";
import type { Set as WorkoutSet, SetType } from "@/generated/prisma/client";
import {
  deleteSetAction,
  updateSetAction,
  type SetFormState,
} from "./set-actions";
import { SetFields } from "./set-fields";
import { formatSetSummary } from "@/lib/format-set-summary";

export function SetRow({
  sessionId,
  set,
  setType,
  target,
  disabled,
}: {
  sessionId: string;
  set: WorkoutSet;
  setType: SetType;
  target: number | null;
  disabled: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const boundUpdate = updateSetAction.bind(null, sessionId, set.id);
  const [state, formAction, pending] = useActionState<SetFormState, FormData>(
    boundUpdate,
    undefined,
  );

  const [prevState, setPrevState] = useState(state);
  if (state !== prevState) {
    setPrevState(state);
    if (state?.success) {
      setEditing(false);
    }
  }

  if (editing) {
    return (
      <li className="space-y-1">
        <form action={formAction} className="flex flex-wrap gap-2">
          <SetFields
            setType={setType}
            defaults={set}
            target={target}
            actions={
              <>
                <button
                  type="submit"
                  disabled={pending}
                  className="bg-primary text-primary-foreground rounded-md px-2 py-1 text-xs font-medium disabled:opacity-50"
                >
                  {pending ? "Saving…" : "Save"}
                </button>
                <button
                  type="button"
                  onClick={() => setEditing(false)}
                  className="text-xs underline"
                >
                  Cancel
                </button>
              </>
            }
          />
        </form>
        {state?.error && (
          <p className="text-destructive text-xs">{state.error}</p>
        )}
      </li>
    );
  }

  return (
    <li className="flex items-center justify-between gap-3">
      <span>{formatSetSummary(set)}</span>
      {!disabled && (
        <span className="flex items-center gap-2 text-xs">
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="underline"
          >
            Edit
          </button>
          <form action={deleteSetAction.bind(null, sessionId, set.id)}>
            <button type="submit" className="text-destructive underline">
              Delete
            </button>
          </form>
        </span>
      )}
    </li>
  );
}
