-- AlterTable
ALTER TABLE "users" ADD COLUMN     "home_equipment" "Equipment"[],
ADD COLUMN     "gym_equipment" "Equipment"[];

-- Backfill: a single "available equipment" list previously applied to every
-- generation regardless of location, so seed both new lists from it rather
-- than leaving them empty and silently changing behavior for existing
-- users - they can split them apart afterward in Account settings.
UPDATE "users" SET "home_equipment" = "available_equipment", "gym_equipment" = "available_equipment";

-- AlterTable
ALTER TABLE "users" DROP COLUMN "available_equipment";
