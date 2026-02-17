-- Align DB defaults/index names with prisma/schema.prisma for schema gate.

ALTER TABLE "Attendance" ALTER COLUMN "updatedAt" DROP DEFAULT;
ALTER TABLE "AttendanceRecord" ALTER COLUMN "updatedAt" DROP DEFAULT;
ALTER TABLE "AttendanceSession" ALTER COLUMN "updatedAt" DROP DEFAULT;
ALTER TABLE "Branch" ALTER COLUMN "updatedAt" DROP DEFAULT;
ALTER TABLE "CommissionScheme" ALTER COLUMN "updatedAt" DROP DEFAULT;
ALTER TABLE "MarketingReport" ALTER COLUMN "updatedAt" DROP DEFAULT;
ALTER TABLE "PayrollItem" ALTER COLUMN "updatedAt" DROP DEFAULT;
ALTER TABLE "PayrollRun" ALTER COLUMN "updatedAt" DROP DEFAULT;
ALTER TABLE "SalaryProfile" ALTER COLUMN "updatedAt" DROP DEFAULT;
ALTER TABLE "StudentAccount" ALTER COLUMN "updatedAt" DROP DEFAULT;
ALTER TABLE "StudentContent" ALTER COLUMN "updatedAt" DROP DEFAULT;
ALTER TABLE "OpsPulse" ALTER COLUMN "bucketStart" DROP DEFAULT;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class WHERE relkind = 'i' AND relname = 'OpsPulse_role_dateKey_windowMinutes_bucketStart_ownerScopeKey_b'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_class WHERE relkind = 'i' AND relname = 'OpsPulse_role_dateKey_windowMinutes_bucketStart_ownerScopeK_key'
  ) THEN
    ALTER INDEX "OpsPulse_role_dateKey_windowMinutes_bucketStart_ownerScopeKey_b"
      RENAME TO "OpsPulse_role_dateKey_windowMinutes_bucketStart_ownerScopeK_key";
  END IF;
END $$;
