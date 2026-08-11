-- AlterTable
ALTER TABLE "sets" ADD COLUMN     "suggested_distance_meters" DOUBLE PRECISION,
ADD COLUMN     "suggested_duration_seconds" INTEGER,
ADD COLUMN     "suggested_reps" INTEGER,
ADD COLUMN     "suggested_weight" DOUBLE PRECISION,
ADD COLUMN     "suggested_weight_unit" "WeightUnit";

-- AlterTable
ALTER TABLE "workout_exercises" ADD COLUMN     "target_weight" DOUBLE PRECISION,
ADD COLUMN     "target_weight_unit" "WeightUnit";
