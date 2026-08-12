-- CreateEnum
CREATE TYPE "CardioFinisherPreference" AS ENUM ('ALWAYS', 'NEVER', 'SOMETIMES');

-- CreateEnum
CREATE TYPE "Equipment" AS ENUM ('BARBELL', 'DUMBBELLS', 'KETTLEBELLS', 'MACHINES', 'CABLES', 'RESISTANCE_BANDS', 'PULL_UP_BAR');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "available_equipment" "Equipment"[],
ADD COLUMN     "avoided_exercises_note" TEXT,
ADD COLUMN     "cardio_finisher_preference" "CardioFinisherPreference" NOT NULL DEFAULT 'SOMETIMES',
ADD COLUMN     "preferred_duration_minutes" INTEGER;
