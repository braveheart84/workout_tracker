-- CreateEnum
CREATE TYPE "WorkoutSessionStatus" AS ENUM ('PLANNED', 'IN_PROGRESS', 'COMPLETED', 'DISCARDED');

-- CreateEnum
CREATE TYPE "WorkoutSessionType" AS ENUM ('STRENGTH', 'RUN');

-- CreateEnum
CREATE TYPE "WorkoutSessionSource" AS ENUM ('MANUAL', 'AI_GENERATED');

-- CreateTable
CREATE TABLE "workout_sessions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "status" "WorkoutSessionStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "type" "WorkoutSessionType" NOT NULL DEFAULT 'STRENGTH',
    "label" TEXT,
    "warmup_notes" TEXT,
    "finisher_notes" TEXT,
    "cooldown_notes" TEXT,
    "source" "WorkoutSessionSource" NOT NULL DEFAULT 'MANUAL',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "workout_sessions_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "workout_sessions" ADD CONSTRAINT "workout_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
