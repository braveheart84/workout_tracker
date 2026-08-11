-- CreateEnum
CREATE TYPE "FocusArea" AS ENUM ('STRENGTH', 'CARDIO', 'HIIT', 'MOBILITY');

-- AlterTable
ALTER TABLE "workout_plans" ADD COLUMN     "based_on_session_id" TEXT,
ADD COLUMN     "focus_tags" "FocusArea"[];
