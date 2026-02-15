DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'OpsPulseRole') THEN
    CREATE TYPE "OpsPulseRole" AS ENUM ('PAGE', 'TELESALES');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "OpsPulse" (
  "id" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "role" "OpsPulseRole" NOT NULL,
  "ownerId" TEXT,
  "branchId" TEXT,
  "dateKey" TEXT NOT NULL,
  "windowMinutes" INTEGER NOT NULL DEFAULT 10,
  "payloadJson" JSONB NOT NULL,
  "computedJson" JSONB NOT NULL,
  CONSTRAINT "OpsPulse_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'OpsPulse_ownerId_fkey') THEN
    ALTER TABLE "OpsPulse"
      ADD CONSTRAINT "OpsPulse_ownerId_fkey"
      FOREIGN KEY ("ownerId") REFERENCES "User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'OpsPulse_branchId_fkey') THEN
    ALTER TABLE "OpsPulse"
      ADD CONSTRAINT "OpsPulse_branchId_fkey"
      FOREIGN KEY ("branchId") REFERENCES "Branch"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "OpsPulse_role_dateKey_createdAt_idx"
  ON "OpsPulse"("role", "dateKey", "createdAt");

CREATE INDEX IF NOT EXISTS "OpsPulse_ownerId_createdAt_idx"
  ON "OpsPulse"("ownerId", "createdAt");
