DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'EmployeeKpiRole') THEN
    CREATE TYPE "EmployeeKpiRole" AS ENUM ('PAGE', 'TELESALES');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "EmployeeKpiSetting" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "role" "EmployeeKpiRole" NOT NULL,
  "effectiveFrom" TIMESTAMP(3) NOT NULL,
  "effectiveTo" TIMESTAMP(3),
  "targetsJson" JSONB NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EmployeeKpiSetting_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'EmployeeKpiSetting_userId_fkey') THEN
    ALTER TABLE "EmployeeKpiSetting"
      ADD CONSTRAINT "EmployeeKpiSetting_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "EmployeeKpiSetting_userId_role_effectiveFrom_idx"
  ON "EmployeeKpiSetting"("userId", "role", "effectiveFrom");

CREATE INDEX IF NOT EXISTS "EmployeeKpiSetting_role_isActive_idx"
  ON "EmployeeKpiSetting"("role", "isActive");
