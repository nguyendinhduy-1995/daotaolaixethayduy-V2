CREATE TABLE IF NOT EXISTS "MarketingReport" (
  "id" TEXT NOT NULL,
  "date" TIMESTAMP(3) NOT NULL,
  "dateKey" TEXT NOT NULL,
  "branchId" TEXT,
  "source" TEXT NOT NULL,
  "spendVnd" INTEGER NOT NULL,
  "messages" INTEGER NOT NULL,
  "cplVnd" INTEGER NOT NULL,
  "metaJson" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MarketingReport_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'MarketingReport_branchId_fkey'
  ) THEN
    ALTER TABLE "MarketingReport"
      ADD CONSTRAINT "MarketingReport_branchId_fkey"
      FOREIGN KEY ("branchId") REFERENCES "Branch"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "MarketingReport_dateKey_branchId_source_key"
  ON "MarketingReport"("dateKey", "branchId", "source");

CREATE INDEX IF NOT EXISTS "MarketingReport_dateKey_idx"
  ON "MarketingReport"("dateKey");

CREATE INDEX IF NOT EXISTS "MarketingReport_branchId_dateKey_idx"
  ON "MarketingReport"("branchId", "dateKey");
