-- CreateEnum
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'OutboundPriority') THEN
    CREATE TYPE "OutboundPriority" AS ENUM ('HIGH','MEDIUM','LOW');
  END IF;
END $$;

-- AlterTable
ALTER TABLE "OutboundMessage"
  ADD COLUMN IF NOT EXISTS "priority" "OutboundPriority" NOT NULL DEFAULT 'MEDIUM',
  ADD COLUMN IF NOT EXISTS "leaseId" TEXT,
  ADD COLUMN IF NOT EXISTS "leaseExpiresAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "dispatchedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "OutboundMessage_leaseExpiresAt_idx" ON "OutboundMessage"("leaseExpiresAt");
