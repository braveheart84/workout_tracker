import { z } from "zod";

// PRD 7.2: each suggestion is a structured workout - one or more blocks,
// each with its exercises, round count, and suggested sets/reps/weight/
// duration/distance as appropriate per exercise. Mirrors the shape of
// WorkoutBlock/WorkoutExercise/Set (Section 9) closely enough that an
// accepted suggestion maps directly onto those tables (PR-14).
//
// The suggested set is a flat object with all fields present (nullable)
// rather than a discriminated union keyed on setType - a plain object is
// far more reliable for an LLM to fill in correctly via tool use than a
// oneOf/anyOf branch, and the setType/field pairing is still enforced at
// parse time via refine, the same pattern used for user-submitted sets in
// set-actions.ts.
export const suggestedSetSchema = z
  .object({
    setType: z.enum(["REPS", "DURATION", "DISTANCE"]),
    reps: z.number().int().min(1).max(1000).nullable(),
    durationSeconds: z.number().int().min(1).max(36000).nullable(),
    distanceMeters: z.number().positive().max(1000000).nullable(),
    weight: z.number().min(0).max(10000).nullable(),
    weightUnit: z.enum(["KG", "LB"]).nullable(),
  })
  .refine(
    (set) => {
      if (set.setType === "REPS") return set.reps !== null;
      if (set.setType === "DURATION") return set.durationSeconds !== null;
      return set.distanceMeters !== null;
    },
    {
      message: "Suggested set is missing the field required for its set type.",
    },
  );

export const suggestedExerciseSchema = z.object({
  name: z.string().min(1).max(100),
  muscleGroup: z.string().max(100).nullable(),
  suggestedSet: suggestedSetSchema,
});

export const suggestedBlockSchema = z.object({
  roundCount: z.number().int().min(1).max(50),
  restSeconds: z.number().int().min(0).max(3600).nullable(),
  exercises: z.array(suggestedExerciseSchema).min(1).max(20),
});

export const workoutSuggestionSchema = z.object({
  label: z.string().max(100).nullable(),
  rationale: z.string().max(1000).nullable(),
  blocks: z.array(suggestedBlockSchema).min(1).max(20),
});

export type SuggestedSet = z.infer<typeof suggestedSetSchema>;
export type SuggestedExercise = z.infer<typeof suggestedExerciseSchema>;
export type SuggestedBlock = z.infer<typeof suggestedBlockSchema>;
export type WorkoutSuggestion = z.infer<typeof workoutSuggestionSchema>;

// PRD 7.2 (multi-day): a range request returns one suggestion per day, in
// order, so the model can spread variety/spacing (muscle groups, intensity)
// across the whole batch in a single call rather than N independent calls
// with no visibility into each other (PR-16).
export const multiDaySuggestionSchema = z.object({
  days: z.array(workoutSuggestionSchema).min(1).max(7),
});

export type MultiDaySuggestion = z.infer<typeof multiDaySuggestionSchema>;
