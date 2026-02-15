-- Add PAID50 source type safely
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'CommissionSourceType' AND e.enumlabel = 'PAID50'
  ) THEN
    ALTER TYPE "CommissionSourceType" ADD VALUE 'PAID50';
  END IF;
END $$;

-- Branch config for paid50 commission rate
ALTER TABLE "Branch"
  ADD COLUMN IF NOT EXISTS "commissionPerPaid50" INTEGER;

-- Extend commission ledger for paid50 one-time tracking
ALTER TABLE "CommissionLedger"
  ADD COLUMN IF NOT EXISTS "studentId" TEXT,
  ADD COLUMN IF NOT EXISTS "metaJson" JSONB;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'CommissionLedger_studentId_fkey'
  ) THEN
    ALTER TABLE "CommissionLedger"
      ADD CONSTRAINT "CommissionLedger_studentId_fkey"
      FOREIGN KEY ("studentId") REFERENCES "Student"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "CommissionLedger_sourceType_studentId_key"
  ON "CommissionLedger"("sourceType", "studentId");
