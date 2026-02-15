ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "branchId" TEXT;

ALTER TABLE "Branch"
  ADD COLUMN IF NOT EXISTS "code" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'User_branchId_fkey'
  ) THEN
    ALTER TABLE "User"
      ADD CONSTRAINT "User_branchId_fkey"
      FOREIGN KEY ("branchId") REFERENCES "Branch"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "User_branchId_idx"
  ON "User"("branchId");

CREATE UNIQUE INDEX IF NOT EXISTS "Branch_code_key"
  ON "Branch"("code");
