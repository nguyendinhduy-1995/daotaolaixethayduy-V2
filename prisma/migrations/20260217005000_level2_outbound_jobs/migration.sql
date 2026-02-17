-- Level 2 skeleton: outbound job contract + permission module

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'OutboundJobStatus' AND n.nspname = 'public'
  ) THEN
    CREATE TYPE "OutboundJobStatus" AS ENUM ('NEW', 'DISPATCHED', 'DONE', 'FAILED');
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PermissionModule') THEN
    BEGIN
      ALTER TYPE "PermissionModule" ADD VALUE 'outbound_jobs';
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "OutboundJob" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "status" "OutboundJobStatus" NOT NULL DEFAULT 'NEW',
  "runId" TEXT,
  "lastError" TEXT,
  "idempotencyKey" TEXT,
  "dispatchedAt" TIMESTAMP(3),
  "doneAt" TIMESTAMP(3),
  "payloadJson" JSONB,
  "suggestionId" TEXT,
  "branchId" TEXT NOT NULL,
  "ownerId" TEXT,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OutboundJob_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "OutboundJob_branchId_status_createdAt_idx" ON "OutboundJob"("branchId", "status", "createdAt");
CREATE INDEX IF NOT EXISTS "OutboundJob_ownerId_status_createdAt_idx" ON "OutboundJob"("ownerId", "status", "createdAt");
CREATE INDEX IF NOT EXISTS "OutboundJob_suggestionId_createdAt_idx" ON "OutboundJob"("suggestionId", "createdAt");
CREATE INDEX IF NOT EXISTS "OutboundJob_runId_idx" ON "OutboundJob"("runId");
CREATE UNIQUE INDEX IF NOT EXISTS "OutboundJob_idempotencyKey_key" ON "OutboundJob"("idempotencyKey");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'OutboundJob_suggestionId_fkey'
  ) THEN
    ALTER TABLE "OutboundJob"
      ADD CONSTRAINT "OutboundJob_suggestionId_fkey"
      FOREIGN KEY ("suggestionId") REFERENCES "AiSuggestion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'OutboundJob_branchId_fkey'
  ) THEN
    ALTER TABLE "OutboundJob"
      ADD CONSTRAINT "OutboundJob_branchId_fkey"
      FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'OutboundJob_ownerId_fkey'
  ) THEN
    ALTER TABLE "OutboundJob"
      ADD CONSTRAINT "OutboundJob_ownerId_fkey"
      FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'OutboundJob_createdById_fkey'
  ) THEN
    ALTER TABLE "OutboundJob"
      ADD CONSTRAINT "OutboundJob_createdById_fkey"
      FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
