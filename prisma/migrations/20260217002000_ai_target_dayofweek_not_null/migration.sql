UPDATE "KpiTarget" SET "dayOfWeek" = -1 WHERE "dayOfWeek" IS NULL;

-- AlterTable
ALTER TABLE "KpiTarget" ALTER COLUMN "dayOfWeek" SET NOT NULL,
ALTER COLUMN "dayOfWeek" SET DEFAULT -1;
