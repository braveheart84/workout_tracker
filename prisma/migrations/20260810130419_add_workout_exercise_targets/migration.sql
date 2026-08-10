-- AlterTable
ALTER TABLE "workout_exercises" ADD COLUMN     "target_distance_meters" DOUBLE PRECISION,
ADD COLUMN     "target_duration_seconds" INTEGER,
ADD COLUMN     "target_reps" INTEGER;
