-- CreateEnum
CREATE TYPE "GoalPeriodType" AS ENUM ('DAILY', 'MONTHLY');

-- CreateEnum
CREATE TYPE "AiSuggestionStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "AiScoreColor" AS ENUM ('RED', 'YELLOW', 'GREEN');

-- CreateTable
CREATE TABLE "KpiTarget" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "metricKey" TEXT NOT NULL,
    "targetValue" INTEGER NOT NULL,
    "dayOfWeek" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KpiTarget_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GoalSetting" (
    "id" TEXT NOT NULL,
    "branchId" TEXT,
    "branchScopeKey" TEXT NOT NULL DEFAULT '',
    "periodType" "GoalPeriodType" NOT NULL,
    "dateKey" TEXT,
    "monthKey" TEXT,
    "revenueTarget" INTEGER NOT NULL DEFAULT 0,
    "dossierTarget" INTEGER NOT NULL DEFAULT 0,
    "costTarget" INTEGER NOT NULL DEFAULT 0,
    "note" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GoalSetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiSuggestion" (
    "id" TEXT NOT NULL,
    "dateKey" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "branchId" TEXT,
    "ownerId" TEXT,
    "status" "AiSuggestionStatus" NOT NULL DEFAULT 'ACTIVE',
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "scoreColor" "AiScoreColor" NOT NULL,
    "actionsJson" JSONB,
    "metricsJson" JSONB,
    "source" TEXT NOT NULL,
    "runId" TEXT,
    "payloadHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiSuggestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiSuggestionFeedback" (
    "id" TEXT NOT NULL,
    "suggestionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "applied" BOOLEAN NOT NULL DEFAULT false,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiSuggestionFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "KpiTarget_branchId_role_isActive_idx" ON "KpiTarget"("branchId", "role", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "KpiTarget_branchId_role_metricKey_dayOfWeek_key" ON "KpiTarget"("branchId", "role", "metricKey", "dayOfWeek");

-- CreateIndex
CREATE INDEX "GoalSetting_branchId_periodType_dateKey_idx" ON "GoalSetting"("branchId", "periodType", "dateKey");

-- CreateIndex
CREATE INDEX "GoalSetting_branchId_periodType_monthKey_idx" ON "GoalSetting"("branchId", "periodType", "monthKey");

-- CreateIndex
CREATE UNIQUE INDEX "GoalSetting_branchScopeKey_periodType_dateKey_monthKey_key" ON "GoalSetting"("branchScopeKey", "periodType", "dateKey", "monthKey");

-- CreateIndex
CREATE INDEX "AiSuggestion_dateKey_role_branchId_ownerId_idx" ON "AiSuggestion"("dateKey", "role", "branchId", "ownerId");

-- CreateIndex
CREATE INDEX "AiSuggestion_runId_idx" ON "AiSuggestion"("runId");

-- CreateIndex
CREATE INDEX "AiSuggestionFeedback_suggestionId_createdAt_idx" ON "AiSuggestionFeedback"("suggestionId", "createdAt");

-- CreateIndex
CREATE INDEX "AiSuggestionFeedback_userId_createdAt_idx" ON "AiSuggestionFeedback"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "KpiTarget" ADD CONSTRAINT "KpiTarget_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoalSetting" ADD CONSTRAINT "GoalSetting_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoalSetting" ADD CONSTRAINT "GoalSetting_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiSuggestion" ADD CONSTRAINT "AiSuggestion_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiSuggestion" ADD CONSTRAINT "AiSuggestion_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiSuggestionFeedback" ADD CONSTRAINT "AiSuggestionFeedback_suggestionId_fkey" FOREIGN KEY ("suggestionId") REFERENCES "AiSuggestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiSuggestionFeedback" ADD CONSTRAINT "AiSuggestionFeedback_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
