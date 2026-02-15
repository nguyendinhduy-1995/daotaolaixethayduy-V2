-- CreateEnum
CREATE TYPE "LeadEventType" AS ENUM (
  'NEW',
  'HAS_PHONE',
  'APPOINTED',
  'ARRIVED',
  'SIGNED',
  'STUDYING',
  'EXAMED',
  'RESULT',
  'LOST',
  'CALLED',
  'OWNER_CHANGED',
  'ASSIGNED_OWNER',
  'OTHER'
);

-- Migrate text event type to enum with safe fallback
ALTER TABLE "LeadEvent" ADD COLUMN "type_new" "LeadEventType";

UPDATE "LeadEvent"
SET "type_new" = CASE UPPER("type")
  WHEN 'NEW' THEN 'NEW'::"LeadEventType"
  WHEN 'HAS_PHONE' THEN 'HAS_PHONE'::"LeadEventType"
  WHEN 'APPOINTED' THEN 'APPOINTED'::"LeadEventType"
  WHEN 'ARRIVED' THEN 'ARRIVED'::"LeadEventType"
  WHEN 'SIGNED' THEN 'SIGNED'::"LeadEventType"
  WHEN 'STUDYING' THEN 'STUDYING'::"LeadEventType"
  WHEN 'EXAMED' THEN 'EXAMED'::"LeadEventType"
  WHEN 'RESULT' THEN 'RESULT'::"LeadEventType"
  WHEN 'LOST' THEN 'LOST'::"LeadEventType"
  WHEN 'CALLED' THEN 'CALLED'::"LeadEventType"
  WHEN 'OWNER_CHANGED' THEN 'OWNER_CHANGED'::"LeadEventType"
  WHEN 'ASSIGNED_OWNER' THEN 'ASSIGNED_OWNER'::"LeadEventType"
  ELSE 'OTHER'::"LeadEventType"
END;

ALTER TABLE "LeadEvent" ALTER COLUMN "type_new" SET NOT NULL;

DROP INDEX IF EXISTS "LeadEvent_type_createdAt_idx";
ALTER TABLE "LeadEvent" DROP COLUMN "type";
ALTER TABLE "LeadEvent" RENAME COLUMN "type_new" TO "type";
CREATE INDEX "LeadEvent_type_createdAt_idx" ON "LeadEvent"("type", "createdAt");
