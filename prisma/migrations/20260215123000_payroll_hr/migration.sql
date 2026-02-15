-- CreateEnum
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'HrAttendanceStatus') THEN
    CREATE TYPE "HrAttendanceStatus" AS ENUM ('PRESENT','HALF','OFF','LEAVE_PAID','LEAVE_UNPAID','LATE','ABSENT');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'HrAttendanceSource') THEN
    CREATE TYPE "HrAttendanceSource" AS ENUM ('MANUAL','IMPORT','DEVICE');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'CommissionSourceType') THEN
    CREATE TYPE "CommissionSourceType" AS ENUM ('RECEIPT','LEAD','STUDENT','MANUAL_ADJUST');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PayrollStatus') THEN
    CREATE TYPE "PayrollStatus" AS ENUM ('DRAFT','FINAL','PAID');
  END IF;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "Branch" (
  "id" TEXT PRIMARY KEY,
  "name" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "CommissionScheme" (
  "id" TEXT PRIMARY KEY,
  "name" TEXT NOT NULL,
  "role" TEXT,
  "rulesJson" JSONB NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "SalaryProfile" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "branchId" TEXT NOT NULL,
  "roleTitle" TEXT NOT NULL,
  "baseSalaryVnd" INTEGER NOT NULL,
  "allowanceVnd" INTEGER NOT NULL DEFAULT 0,
  "standardDays" INTEGER NOT NULL,
  "commissionSchemeId" TEXT,
  "effectiveFrom" TIMESTAMP(3) NOT NULL,
  "effectiveTo" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SalaryProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "SalaryProfile_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "SalaryProfile_commissionSchemeId_fkey" FOREIGN KEY ("commissionSchemeId") REFERENCES "CommissionScheme"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "Attendance" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "branchId" TEXT NOT NULL,
  "date" TIMESTAMP(3) NOT NULL,
  "status" "HrAttendanceStatus" NOT NULL,
  "minutesLate" INTEGER,
  "note" TEXT,
  "source" "HrAttendanceSource" NOT NULL DEFAULT 'MANUAL',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Attendance_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "Attendance_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "CommissionLedger" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "branchId" TEXT NOT NULL,
  "periodMonth" TEXT NOT NULL,
  "sourceType" "CommissionSourceType" NOT NULL,
  "sourceId" TEXT,
  "amountBaseVnd" INTEGER NOT NULL,
  "commissionVnd" INTEGER NOT NULL,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CommissionLedger_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "CommissionLedger_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "PayrollRun" (
  "id" TEXT PRIMARY KEY,
  "month" TEXT NOT NULL,
  "branchId" TEXT NOT NULL,
  "status" "PayrollStatus" NOT NULL DEFAULT 'DRAFT',
  "generatedAt" TIMESTAMP(3),
  "generatedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PayrollRun_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "PayrollRun_generatedById_fkey" FOREIGN KEY ("generatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "PayrollItem" (
  "id" TEXT PRIMARY KEY,
  "payrollRunId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "baseSalaryVnd" INTEGER NOT NULL,
  "allowanceVnd" INTEGER NOT NULL,
  "daysWorked" DOUBLE PRECISION NOT NULL,
  "standardDays" INTEGER NOT NULL,
  "baseProratedVnd" INTEGER NOT NULL,
  "commissionVnd" INTEGER NOT NULL,
  "penaltyVnd" INTEGER NOT NULL,
  "bonusVnd" INTEGER NOT NULL,
  "totalVnd" INTEGER NOT NULL,
  "breakdownJson" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PayrollItem_payrollRunId_fkey" FOREIGN KEY ("payrollRunId") REFERENCES "PayrollRun"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "PayrollItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Indexes
CREATE UNIQUE INDEX IF NOT EXISTS "Attendance_userId_date_key" ON "Attendance"("userId","date");
CREATE INDEX IF NOT EXISTS "Attendance_branchId_date_idx" ON "Attendance"("branchId","date");
CREATE INDEX IF NOT EXISTS "SalaryProfile_userId_effectiveFrom_idx" ON "SalaryProfile"("userId","effectiveFrom");
CREATE INDEX IF NOT EXISTS "SalaryProfile_branchId_effectiveFrom_idx" ON "SalaryProfile"("branchId","effectiveFrom");
CREATE INDEX IF NOT EXISTS "CommissionLedger_periodMonth_userId_idx" ON "CommissionLedger"("periodMonth","userId");
CREATE INDEX IF NOT EXISTS "CommissionLedger_branchId_periodMonth_idx" ON "CommissionLedger"("branchId","periodMonth");
CREATE UNIQUE INDEX IF NOT EXISTS "PayrollRun_month_branchId_key" ON "PayrollRun"("month","branchId");
CREATE UNIQUE INDEX IF NOT EXISTS "PayrollItem_payrollRunId_userId_key" ON "PayrollItem"("payrollRunId","userId");
