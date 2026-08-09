"use client";

import { useActionState, useState } from "react";
import type { Exercise } from "@/generated/prisma/client";
import {
  deleteBlockAction,
  moveBlockAction,
  updateBlockAction,
  type BlockFormState,
} from "./block-actions";
import { AddExerciseToBlockForm } from "./add-exercise-to-block-form";
import { ExerciseInBlockRow } from "./exercise-in-block-row";

type BlockWithExercises = {
  id: string;
  order: number;
  roundCount: number;
  restSeconds: number | null;
  workoutExercises: { id: string; order: number; exercise: Exercise }[];
};

export function BlockCard({
  sessionId,
  block,
  exercises,
  disabled,
  isFirst,
  isLast,
}: {
  sessionId: string;
  block: BlockWithExercises;
  exercises: Exercise[];
  disabled: boolean;
  isFirst: boolean;
  isLast: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const boundUpdate = updateBlockAction.bind(null, sessionId, block.id);
  const [state, formAction, pending] = useActionState<BlockFormState, FormData>(
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

  const summary = `${block.roundCount} round${block.roundCount === 1 ? "" : "s"}${
    block.restSeconds ? `, ${block.restSeconds}s rest` : ""
  }`;

  const sortedExercises = [...block.workoutExercises].sort(
    (a, b) => a.order - b.order,
  );

  return (
    <li className="space-y-3 rounded-md border p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">{summary}</p>
        {!disabled && (
          <div className="flex items-center gap-3 text-xs">
            <button
              type="button"
              onClick={() => setEditing((v) => !v)}
              className="underline"
            >
              {editing ? "Close" : "Edit"}
            </button>
            <form
              action={moveBlockAction.bind(null, sessionId, block.id, "up")}
            >
              <button
                type="submit"
                disabled={isFirst}
                className="underline disabled:opacity-30"
              >
                Move up
              </button>
            </form>
            <form
              action={moveBlockAction.bind(null, sessionId, block.id, "down")}
            >
              <button
                type="submit"
                disabled={isLast}
                className="underline disabled:opacity-30"
              >
                Move down
              </button>
            </form>
            <form
              action={deleteBlockAction.bind(null, sessionId, block.id)}
              onSubmit={(e) => {
                if (!confirm("Remove this block and its exercises?")) {
                  e.preventDefault();
                }
              }}
            >
              <button type="submit" className="text-destructive underline">
                Remove
              </button>
            </form>
          </div>
        )}
      </div>

      {editing && (
        <form action={formAction} className="flex items-end gap-3">
          <div className="space-y-1">
            <label className="text-xs font-medium">Rounds</label>
            <input
              type="number"
              name="roundCount"
              min={1}
              max={50}
              defaultValue={block.roundCount}
              className="border-input bg-background w-20 rounded-md border px-2 py-1 text-sm"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium">Rest (seconds)</label>
            <input
              type="number"
              name="restSeconds"
              min={0}
              max={3600}
              defaultValue={block.restSeconds ?? ""}
              className="border-input bg-background w-24 rounded-md border px-2 py-1 text-sm"
            />
          </div>
          <button
            type="submit"
            disabled={pending}
            className="bg-primary text-primary-foreground rounded-md px-3 py-2 text-sm font-medium disabled:opacity-50"
          >
            {pending ? "Saving…" : "Save"}
          </button>
        </form>
      )}
      {state?.error && (
        <p className="text-destructive text-sm">{state.error}</p>
      )}

      {sortedExercises.length > 0 && (
        <ul className="divide-border divide-y rounded-md border">
          {sortedExercises.map((we, index) => (
            <ExerciseInBlockRow
              key={we.id}
              sessionId={sessionId}
              blockId={block.id}
              workoutExercise={we}
              disabled={disabled}
              isFirst={index === 0}
              isLast={index === sortedExercises.length - 1}
            />
          ))}
        </ul>
      )}

      {!disabled && (
        <AddExerciseToBlockForm
          sessionId={sessionId}
          blockId={block.id}
          exercises={exercises}
        />
      )}
    </li>
  );
}
