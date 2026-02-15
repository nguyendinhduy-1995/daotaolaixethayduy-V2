-- Add idempotency fields for OpsPulse
ALTER TABLE "OpsPulse"
  ADD COLUMN "ownerScopeKey" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "branchScopeKey" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "bucketStart" TIMESTAMP(3) NOT NULL DEFAULT NOW();

-- Backfill scope keys and 10-minute bucket start for existing records
UPDATE "OpsPulse"
SET
  "ownerScopeKey" = COALESCE("ownerId", ''),
  "branchScopeKey" = COALESCE("branchId", ''),
  "bucketStart" = to_timestamp(
    floor(extract(epoch from "createdAt") / (GREATEST("windowMinutes", 1) * 60)) * (GREATEST("windowMinutes", 1) * 60)
  );

-- Enforce uniqueness by role/date/window/scope bucket
CREATE UNIQUE INDEX "OpsPulse_role_dateKey_windowMinutes_bucketStart_ownerScopeKey_branchScopeKey_key"
ON "OpsPulse"("role", "dateKey", "windowMinutes", "bucketStart", "ownerScopeKey", "branchScopeKey");
