-- CreateEnum
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'OutboundChannel') THEN
    CREATE TYPE "OutboundChannel" AS ENUM ('ZALO','FB','SMS','CALL_NOTE');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'OutboundStatus') THEN
    CREATE TYPE "OutboundStatus" AS ENUM ('QUEUED','SENT','FAILED','SKIPPED');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'OutboundPriority') THEN
    CREATE TYPE "OutboundPriority" AS ENUM ('HIGH','MEDIUM','LOW');
  END IF;
END $$;

-- Backfill missing table for clean/shadow databases.
-- This repo has historical migrations that reference OutboundMessage
-- but did not include the base CREATE TABLE migration.
CREATE TABLE IF NOT EXISTS "OutboundMessage" (
  "id" TEXT NOT NULL,
  "channel" "OutboundChannel" NOT NULL,
  "to" TEXT,
  "templateKey" TEXT NOT NULL,
  "renderedText" TEXT NOT NULL,
  "status" "OutboundStatus" NOT NULL DEFAULT 'QUEUED',
  "priority" "OutboundPriority" NOT NULL DEFAULT 'MEDIUM',
  "error" TEXT,
  "leadId" TEXT,
  "studentId" TEXT,
  "notificationId" TEXT,
  "retryCount" INTEGER NOT NULL DEFAULT 0,
  "nextAttemptAt" TIMESTAMP(3),
  "providerMessageId" TEXT,
  "leaseId" TEXT,
  "leaseExpiresAt" TIMESTAMP(3),
  "dispatchedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "sentAt" TIMESTAMP(3),
  CONSTRAINT "OutboundMessage_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  ALTER TABLE "OutboundMessage"
    ADD CONSTRAINT "OutboundMessage_leadId_fkey"
      FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "OutboundMessage"
    ADD CONSTRAINT "OutboundMessage_studentId_fkey"
      FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- AlterTable
ALTER TABLE "OutboundMessage"
  ADD COLUMN IF NOT EXISTS "priority" "OutboundPriority" NOT NULL DEFAULT 'MEDIUM',
  ADD COLUMN IF NOT EXISTS "leaseId" TEXT,
  ADD COLUMN IF NOT EXISTS "leaseExpiresAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "dispatchedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "OutboundMessage_leaseExpiresAt_idx" ON "OutboundMessage"("leaseExpiresAt");
CREATE INDEX IF NOT EXISTS "OutboundMessage_status_nextAttemptAt_idx" ON "OutboundMessage"("status","nextAttemptAt");
CREATE INDEX IF NOT EXISTS "OutboundMessage_studentId_createdAt_idx" ON "OutboundMessage"("studentId","createdAt");
CREATE INDEX IF NOT EXISTS "OutboundMessage_leadId_createdAt_idx" ON "OutboundMessage"("leadId","createdAt");
