-- Level 2 hardening: link OutboundJob -> Task + meta contract

ALTER TABLE "OutboundJob"
  ADD COLUMN IF NOT EXISTS "metaJson" JSONB,
  ADD COLUMN IF NOT EXISTS "taskId" TEXT;

CREATE INDEX IF NOT EXISTS "OutboundJob_taskId_createdAt_idx" ON "OutboundJob"("taskId", "createdAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'OutboundJob_taskId_fkey'
  ) THEN
    ALTER TABLE "OutboundJob"
      ADD CONSTRAINT "OutboundJob_taskId_fkey"
      FOREIGN KEY ("taskId") REFERENCES "Notification"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
