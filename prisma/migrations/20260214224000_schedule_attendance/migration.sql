-- CreateEnum
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'AttendanceStatus') THEN
    CREATE TYPE "AttendanceStatus" AS ENUM ('PRESENT','ABSENT','LATE');
  END IF;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "AttendanceSession" (
  "id" TEXT PRIMARY KEY,
  "scheduleItemId" TEXT NOT NULL UNIQUE,
  "note" TEXT,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AttendanceSession_scheduleItemId_fkey" FOREIGN KEY ("scheduleItemId") REFERENCES "CourseScheduleItem"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "AttendanceSession_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "AttendanceRecord" (
  "id" TEXT PRIMARY KEY,
  "sessionId" TEXT NOT NULL,
  "scheduleItemId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "status" "AttendanceStatus" NOT NULL,
  "note" TEXT,
  "updatedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AttendanceRecord_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "AttendanceSession"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "AttendanceRecord_scheduleItemId_fkey" FOREIGN KEY ("scheduleItemId") REFERENCES "CourseScheduleItem"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "AttendanceRecord_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "AttendanceRecord_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "AttendanceAudit" (
  "id" TEXT PRIMARY KEY,
  "scheduleItemId" TEXT NOT NULL,
  "actorId" TEXT,
  "action" TEXT NOT NULL,
  "diff" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AttendanceAudit_scheduleItemId_fkey" FOREIGN KEY ("scheduleItemId") REFERENCES "CourseScheduleItem"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "AttendanceAudit_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "AttendanceRecord_studentId_scheduleItemId_key" ON "AttendanceRecord"("studentId", "scheduleItemId");
CREATE INDEX IF NOT EXISTS "AttendanceRecord_scheduleItemId_createdAt_idx" ON "AttendanceRecord"("scheduleItemId", "createdAt");
CREATE INDEX IF NOT EXISTS "AttendanceAudit_scheduleItemId_createdAt_idx" ON "AttendanceAudit"("scheduleItemId", "createdAt");
