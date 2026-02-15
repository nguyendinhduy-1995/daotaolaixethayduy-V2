-- CreateEnum
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'MarketingGrain') THEN
    CREATE TYPE "MarketingGrain" AS ENUM ('DAY','MONTH','YEAR');
  END IF;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "MarketingMetric" (
  "id" TEXT PRIMARY KEY,
  "source" TEXT NOT NULL,
  "grain" "MarketingGrain" NOT NULL,
  "dateKey" TEXT NOT NULL,
  "spendVnd" INTEGER NOT NULL,
  "messages" INTEGER NOT NULL,
  "cplVnd" DOUBLE PRECISION NOT NULL,
  "meta" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "MarketingMetric_source_grain_dateKey_key" ON "MarketingMetric"("source","grain","dateKey");
CREATE INDEX IF NOT EXISTS "MarketingMetric_grain_dateKey_idx" ON "MarketingMetric"("grain","dateKey");
CREATE INDEX IF NOT EXISTS "MarketingMetric_source_grain_dateKey_idx" ON "MarketingMetric"("source","grain","dateKey");
