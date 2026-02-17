UPDATE "GoalSetting" SET "dateKey" = '' WHERE "dateKey" IS NULL;
UPDATE "GoalSetting" SET "monthKey" = '' WHERE "monthKey" IS NULL;

-- AlterTable
ALTER TABLE "GoalSetting" ALTER COLUMN "dateKey" SET NOT NULL,
ALTER COLUMN "dateKey" SET DEFAULT '',
ALTER COLUMN "monthKey" SET NOT NULL,
ALTER COLUMN "monthKey" SET DEFAULT '';
