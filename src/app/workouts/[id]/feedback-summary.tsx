import { DIFFICULTY_LABELS } from "@/lib/difficulty";

export function FeedbackSummary({
  difficultyRating,
  difficultyNote,
  energyRating,
  goalForNext,
}: {
  difficultyRating: number | null;
  difficultyNote: string | null;
  energyRating: number | null;
  goalForNext: string | null;
}) {
  const hasFeedback =
    difficultyRating != null ||
    difficultyNote != null ||
    energyRating != null ||
    goalForNext != null;

  if (!hasFeedback) {
    return null;
  }

  return (
    <div className="space-y-2 rounded-md border p-4 text-sm">
      <h2 className="text-sm font-medium">How it went</h2>
      {difficultyRating != null && (
        <p>
          Difficulty: {difficultyRating}/5 (
          {DIFFICULTY_LABELS[difficultyRating - 1]})
        </p>
      )}
      {difficultyNote && <p>Note: {difficultyNote}</p>}
      {energyRating != null && <p>Energy: {energyRating}/10</p>}
      {goalForNext && <p>Goal for next time: {goalForNext}</p>}
    </div>
  );
}
