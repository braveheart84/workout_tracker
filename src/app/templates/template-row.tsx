"use client";

import type { WorkoutSuggestion } from "@/lib/workout-suggestion-schema";
import { formatSetSummary } from "@/lib/format-set-summary";
import {
  deleteTemplateAction,
  startWorkoutFromTemplateAction,
} from "./actions";

export function TemplateRow({
  id,
  name,
  structure,
}: {
  id: string;
  name: string;
  structure: WorkoutSuggestion;
}) {
  const exerciseCount = structure.blocks.reduce(
    (sum, block) => sum + block.exercises.length,
    0,
  );

  return (
    <li className="space-y-2 p-3">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium">{name}</p>
          <p className="text-muted-foreground text-xs">
            {structure.blocks.length} block
            {structure.blocks.length === 1 ? "" : "s"}, {exerciseCount} exercise
            {exerciseCount === 1 ? "" : "s"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <form action={startWorkoutFromTemplateAction.bind(null, id)}>
            <button
              type="submit"
              className="bg-primary text-primary-foreground rounded-md px-3 py-2 text-xs font-medium"
            >
              Start Workout
            </button>
          </form>
          <form
            action={deleteTemplateAction.bind(null, id)}
            onSubmit={(e) => {
              if (!confirm(`Delete "${name}"?`)) {
                e.preventDefault();
              }
            }}
          >
            <button
              type="submit"
              className="text-destructive text-xs underline"
            >
              Delete
            </button>
          </form>
        </div>
      </div>
      <ul className="text-muted-foreground space-y-0.5 text-xs">
        {structure.blocks.flatMap((block, blockIndex) =>
          block.exercises.map((exercise, exerciseIndex) => (
            <li key={`${blockIndex}-${exerciseIndex}`}>
              {exercise.name} — {formatSetSummary(exercise.suggestedSet)}
            </li>
          )),
        )}
      </ul>
    </li>
  );
}
