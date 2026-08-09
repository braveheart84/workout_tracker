-- CreateTable
CREATE TABLE "workout_blocks" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "round_count" INTEGER NOT NULL DEFAULT 1,
    "rest_seconds" INTEGER,

    CONSTRAINT "workout_blocks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workout_exercises" (
    "id" TEXT NOT NULL,
    "block_id" TEXT NOT NULL,
    "exercise_id" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "note_for_next_time" TEXT,

    CONSTRAINT "workout_exercises_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "workout_blocks" ADD CONSTRAINT "workout_blocks_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "workout_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workout_exercises" ADD CONSTRAINT "workout_exercises_block_id_fkey" FOREIGN KEY ("block_id") REFERENCES "workout_blocks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workout_exercises" ADD CONSTRAINT "workout_exercises_exercise_id_fkey" FOREIGN KEY ("exercise_id") REFERENCES "exercises"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
