-- Automation monitor read-only queries optimization
CREATE INDEX IF NOT EXISTS "AutomationLog_branchId_milestone_sentAt_idx" ON "AutomationLog"("branchId", "milestone", "sentAt");
