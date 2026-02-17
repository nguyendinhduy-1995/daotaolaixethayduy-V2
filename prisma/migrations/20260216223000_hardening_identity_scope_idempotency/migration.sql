-- User.username (email/username login chuẩn)
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "username" TEXT;

UPDATE "User"
SET "username" = lower(regexp_replace(split_part("email", '@', 1), '[^a-zA-Z0-9_]+', '_', 'g'))
WHERE "username" IS NULL;

WITH dupes AS (
  SELECT id, username,
         ROW_NUMBER() OVER (PARTITION BY username ORDER BY "createdAt", id) AS rn
  FROM "User"
)
UPDATE "User" u
SET "username" = concat(d.username, '_', substr(u.id, 1, 6))
FROM dupes d
WHERE u.id = d.id AND d.rn > 1;

ALTER TABLE "User" ALTER COLUMN "username" SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "User_username_key" ON "User"("username");

-- Branch scope columns
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "branchId" TEXT;
ALTER TABLE "Student" ADD COLUMN IF NOT EXISTS "branchId" TEXT;
ALTER TABLE "Receipt" ADD COLUMN IF NOT EXISTS "branchId" TEXT;
ALTER TABLE "CourseScheduleItem" ADD COLUMN IF NOT EXISTS "branchId" TEXT;
ALTER TABLE "AutomationLog" ADD COLUMN IF NOT EXISTS "branchId" TEXT;
ALTER TABLE "OutboundMessage" ADD COLUMN IF NOT EXISTS "branchId" TEXT;

-- Backfill branchId từ dữ liệu liên quan
UPDATE "Lead" l
SET "branchId" = u."branchId"
FROM "User" u
WHERE l."branchId" IS NULL
  AND l."ownerId" = u."id"
  AND u."branchId" IS NOT NULL;

UPDATE "Student" s
SET "branchId" = l."branchId"
FROM "Lead" l
WHERE s."branchId" IS NULL
  AND s."leadId" = l."id"
  AND l."branchId" IS NOT NULL;

UPDATE "Receipt" r
SET "branchId" = s."branchId"
FROM "Student" s
WHERE r."branchId" IS NULL
  AND r."studentId" = s."id"
  AND s."branchId" IS NOT NULL;

UPDATE "CourseScheduleItem" csi
SET "branchId" = x."branchId"
FROM (
  SELECT s."courseId", MIN(s."branchId") AS "branchId"
  FROM "Student" s
  WHERE s."branchId" IS NOT NULL
  GROUP BY s."courseId"
) x
WHERE csi."branchId" IS NULL
  AND csi."courseId" = x."courseId";

UPDATE "AutomationLog" al
SET "branchId" = l."branchId"
FROM "Lead" l
WHERE al."branchId" IS NULL
  AND al."leadId" = l."id"
  AND l."branchId" IS NOT NULL;

UPDATE "AutomationLog" al
SET "branchId" = s."branchId"
FROM "Student" s
WHERE al."branchId" IS NULL
  AND al."studentId" = s."id"
  AND s."branchId" IS NOT NULL;

UPDATE "OutboundMessage" om
SET "branchId" = l."branchId"
FROM "Lead" l
WHERE om."branchId" IS NULL
  AND om."leadId" = l."id"
  AND l."branchId" IS NOT NULL;

UPDATE "OutboundMessage" om
SET "branchId" = s."branchId"
FROM "Student" s
WHERE om."branchId" IS NULL
  AND om."studentId" = s."id"
  AND s."branchId" IS NOT NULL;

-- ExpenseInsight ingest audit fields
ALTER TABLE "ExpenseInsight" ADD COLUMN IF NOT EXISTS "runId" TEXT;
ALTER TABLE "ExpenseInsight" ADD COLUMN IF NOT EXISTS "payloadHash" TEXT;

-- Idempotency store
CREATE TABLE IF NOT EXISTS "IdempotencyRequest" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "route" TEXT NOT NULL,
  "actorType" TEXT NOT NULL,
  "actorId" TEXT NOT NULL,
  "requestHash" TEXT NOT NULL,
  "responseJson" JSONB NOT NULL,
  "statusCode" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "IdempotencyRequest_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "IdempotencyRequest_key_route_actorType_actorId_key"
ON "IdempotencyRequest"("key", "route", "actorType", "actorId");
CREATE INDEX IF NOT EXISTS "IdempotencyRequest_createdAt_idx" ON "IdempotencyRequest"("createdAt");

-- Indexes & FKs
CREATE INDEX IF NOT EXISTS "Lead_branchId_createdAt_idx" ON "Lead"("branchId", "createdAt");
CREATE INDEX IF NOT EXISTS "Student_branchId_idx" ON "Student"("branchId");
CREATE INDEX IF NOT EXISTS "Receipt_branchId_receivedAt_idx" ON "Receipt"("branchId", "receivedAt");
CREATE INDEX IF NOT EXISTS "CourseScheduleItem_branchId_startAt_idx" ON "CourseScheduleItem"("branchId", "startAt");
CREATE INDEX IF NOT EXISTS "AutomationLog_branchId_sentAt_idx" ON "AutomationLog"("branchId", "sentAt");
CREATE INDEX IF NOT EXISTS "OutboundMessage_branchId_createdAt_idx" ON "OutboundMessage"("branchId", "createdAt");
CREATE INDEX IF NOT EXISTS "ExpenseInsight_runId_idx" ON "ExpenseInsight"("runId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Lead_branchId_fkey') THEN
    ALTER TABLE "Lead" ADD CONSTRAINT "Lead_branchId_fkey"
      FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Student_branchId_fkey') THEN
    ALTER TABLE "Student" ADD CONSTRAINT "Student_branchId_fkey"
      FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Receipt_branchId_fkey') THEN
    ALTER TABLE "Receipt" ADD CONSTRAINT "Receipt_branchId_fkey"
      FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CourseScheduleItem_branchId_fkey') THEN
    ALTER TABLE "CourseScheduleItem" ADD CONSTRAINT "CourseScheduleItem_branchId_fkey"
      FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AutomationLog_branchId_fkey') THEN
    ALTER TABLE "AutomationLog" ADD CONSTRAINT "AutomationLog_branchId_fkey"
      FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'OutboundMessage_branchId_fkey') THEN
    ALTER TABLE "OutboundMessage" ADD CONSTRAINT "OutboundMessage_branchId_fkey"
      FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
