-- CreateEnum
CREATE TYPE "SetType" AS ENUM ('REPS', 'DURATION', 'DISTANCE');

-- CreateTable
CREATE TABLE "exercises" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "muscle_group" TEXT,
    "default_set_type" "SetType" NOT NULL DEFAULT 'REPS',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exercises_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "exercises_user_id_name_key" ON "exercises"("user_id", "name");

-- AddForeignKey
ALTER TABLE "exercises" ADD CONSTRAINT "exercises_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
