-- Align OutboundMessage index with schema gate
CREATE INDEX IF NOT EXISTS "OutboundMessage_status_createdAt_idx" ON "OutboundMessage"("status", "createdAt");
