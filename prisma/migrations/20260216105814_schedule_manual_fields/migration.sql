CREATE TYPE "ScheduleSource" AS ENUM ('AUTO', 'MANUAL');
CREATE TYPE "ScheduleManualStatus" AS ENUM ('PLANNED', 'DONE', 'CANCELLED');

ALTER TABLE "CourseScheduleItem"
  ADD COLUMN "source" "ScheduleSource" NOT NULL DEFAULT 'AUTO',
  ADD COLUMN "status" "ScheduleManualStatus" NOT NULL DEFAULT 'PLANNED',
  ADD COLUMN "location" TEXT,
  ADD COLUMN "note" TEXT;

UPDATE "CourseScheduleItem"
SET
  "location" = COALESCE("location", NULLIF("rule"->>'location', '')),
  "note" = COALESCE("note", NULLIF("rule"->>'note', '')),
  "status" = CASE UPPER(COALESCE("rule"->>'status', 'PLANNED'))
    WHEN 'DONE' THEN 'DONE'::"ScheduleManualStatus"
    WHEN 'CANCELLED' THEN 'CANCELLED'::"ScheduleManualStatus"
    ELSE 'PLANNED'::"ScheduleManualStatus"
  END,
  "source" = CASE
    WHEN UPPER(COALESCE("rule"->>'source', '')) = 'MANUAL' THEN 'MANUAL'::"ScheduleSource"
    WHEN COALESCE("rule"->>'manual', 'false') = 'true' THEN 'MANUAL'::"ScheduleSource"
    ELSE 'AUTO'::"ScheduleSource"
  END;
