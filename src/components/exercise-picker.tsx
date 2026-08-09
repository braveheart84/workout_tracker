"use client";

import { useMemo, useState } from "react";
import type { Exercise } from "@/generated/prisma/client";

// A lightweight, hand-built typeahead - deferred from PR-05 (exercise
// library) since nothing consumed it there. First real consumer is
// adding exercises into a workout block (PR-07); designed to be reusable
// wherever else the app needs to pick an exercise from the library.
export function ExercisePicker({
  exercises,
  name = "exerciseId",
  placeholder = "Search exercises…",
}: {
  exercises: Exercise[];
  name?: string;
  placeholder?: string;
}) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Exercise | null>(null);
  const [open, setOpen] = useState(false);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q === "") return exercises;
    return exercises.filter((exercise) =>
      exercise.name.toLowerCase().includes(q),
    );
  }, [exercises, query]);

  return (
    <div className="relative">
      <input
        type="text"
        value={selected ? selected.name : query}
        onChange={(e) => {
          setSelected(null);
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          // Delay so a click on a dropdown option registers before it closes.
          setTimeout(() => setOpen(false), 150);
        }}
        placeholder={placeholder}
        autoComplete="off"
        className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
      />
      <input type="hidden" name={name} value={selected?.id ?? ""} />
      {open && matches.length > 0 && (
        <ul className="bg-popover text-popover-foreground absolute z-10 mt-1 max-h-48 w-full overflow-auto rounded-md border shadow-md">
          {matches.map((exercise) => (
            <li key={exercise.id}>
              <button
                type="button"
                onClick={() => {
                  setSelected(exercise);
                  setQuery("");
                  setOpen(false);
                }}
                className="hover:bg-accent hover:text-accent-foreground w-full px-3 py-2 text-left text-sm"
              >
                {exercise.name}
                {exercise.muscleGroup ? (
                  <span className="text-muted-foreground">
                    {" "}
                    · {exercise.muscleGroup}
                  </span>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      )}
      {open && matches.length === 0 && (
        <div className="bg-popover text-muted-foreground absolute z-10 mt-1 w-full rounded-md border p-3 text-sm shadow-md">
          No matching exercises.
        </div>
      )}
    </div>
  );
}
