-- AlterTable
ALTER TABLE "workout_sessions" ADD COLUMN     "difficulty_note" TEXT,
ADD COLUMN     "difficulty_rating" INTEGER,
ADD COLUMN     "energy_rating" INTEGER,
ADD COLUMN     "goal_for_next" TEXT;
