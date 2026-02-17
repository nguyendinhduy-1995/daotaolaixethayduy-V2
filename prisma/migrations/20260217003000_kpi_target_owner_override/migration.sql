ALTER TABLE "KpiTarget"
ADD COLUMN IF NOT EXISTS "ownerId" TEXT;

DROP INDEX IF EXISTS "KpiTarget_branchId_role_metricKey_dayOfWeek_key";

CREATE INDEX IF NOT EXISTS "KpiTarget_ownerId_idx" ON "KpiTarget"("ownerId");

CREATE UNIQUE INDEX IF NOT EXISTS "KpiTarget_branchId_role_metricKey_dayOfWeek_ownerId_key"
ON "KpiTarget"("branchId", "role", "metricKey", "dayOfWeek", "ownerId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'KpiTarget_ownerId_fkey'
  ) THEN
    ALTER TABLE "KpiTarget"
    ADD CONSTRAINT "KpiTarget_ownerId_fkey"
    FOREIGN KEY ("ownerId") REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
