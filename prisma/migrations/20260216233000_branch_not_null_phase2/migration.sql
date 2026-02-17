-- Ensure default branch exists
INSERT INTO "Branch" ("id", "name", "code", "isActive", "createdAt", "updatedAt")
VALUES ('__DEFAULT_BRANCH__', 'Chi nhánh mặc định', 'DEFAULT', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;

-- Final backfill safety before NOT NULL
UPDATE "Lead" SET "branchId" = '__DEFAULT_BRANCH__' WHERE "branchId" IS NULL;
UPDATE "Student" SET "branchId" = '__DEFAULT_BRANCH__' WHERE "branchId" IS NULL;
UPDATE "Receipt" SET "branchId" = '__DEFAULT_BRANCH__' WHERE "branchId" IS NULL;
UPDATE "CourseScheduleItem" SET "branchId" = '__DEFAULT_BRANCH__' WHERE "branchId" IS NULL;
UPDATE "AutomationLog" SET "branchId" = '__DEFAULT_BRANCH__' WHERE "branchId" IS NULL;
UPDATE "OutboundMessage" SET "branchId" = '__DEFAULT_BRANCH__' WHERE "branchId" IS NULL;

ALTER TABLE "Lead" ALTER COLUMN "branchId" SET NOT NULL;
ALTER TABLE "Student" ALTER COLUMN "branchId" SET NOT NULL;
ALTER TABLE "Receipt" ALTER COLUMN "branchId" SET NOT NULL;
ALTER TABLE "CourseScheduleItem" ALTER COLUMN "branchId" SET NOT NULL;
ALTER TABLE "AutomationLog" ALTER COLUMN "branchId" SET NOT NULL;
ALTER TABLE "OutboundMessage" ALTER COLUMN "branchId" SET NOT NULL;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Lead_branchId_fkey') THEN
    ALTER TABLE "Lead" DROP CONSTRAINT "Lead_branchId_fkey";
  END IF;
  ALTER TABLE "Lead" ADD CONSTRAINT "Lead_branchId_fkey"
    FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Student_branchId_fkey') THEN
    ALTER TABLE "Student" DROP CONSTRAINT "Student_branchId_fkey";
  END IF;
  ALTER TABLE "Student" ADD CONSTRAINT "Student_branchId_fkey"
    FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Receipt_branchId_fkey') THEN
    ALTER TABLE "Receipt" DROP CONSTRAINT "Receipt_branchId_fkey";
  END IF;
  ALTER TABLE "Receipt" ADD CONSTRAINT "Receipt_branchId_fkey"
    FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CourseScheduleItem_branchId_fkey') THEN
    ALTER TABLE "CourseScheduleItem" DROP CONSTRAINT "CourseScheduleItem_branchId_fkey";
  END IF;
  ALTER TABLE "CourseScheduleItem" ADD CONSTRAINT "CourseScheduleItem_branchId_fkey"
    FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AutomationLog_branchId_fkey') THEN
    ALTER TABLE "AutomationLog" DROP CONSTRAINT "AutomationLog_branchId_fkey";
  END IF;
  ALTER TABLE "AutomationLog" ADD CONSTRAINT "AutomationLog_branchId_fkey"
    FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'OutboundMessage_branchId_fkey') THEN
    ALTER TABLE "OutboundMessage" DROP CONSTRAINT "OutboundMessage_branchId_fkey";
  END IF;
  ALTER TABLE "OutboundMessage" ADD CONSTRAINT "OutboundMessage_branchId_fkey"
    FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
END $$;
