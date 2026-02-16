-- CreateTable
CREATE TABLE "AiLearningHistory" (
    "id" TEXT NOT NULL,
    "moduleKey" TEXT NOT NULL,
    "useCaseKey" TEXT NOT NULL,
    "actorId" TEXT,
    "source" TEXT,
    "runId" TEXT,
    "inputJson" JSONB,
    "outputJson" JSONB,
    "feedbackScore" INTEGER,
    "applied" BOOLEAN,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiLearningHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AiLearningHistory_moduleKey_createdAt_idx" ON "AiLearningHistory"("moduleKey", "createdAt");

-- CreateIndex
CREATE INDEX "AiLearningHistory_useCaseKey_createdAt_idx" ON "AiLearningHistory"("useCaseKey", "createdAt");

-- CreateIndex
CREATE INDEX "AiLearningHistory_actorId_createdAt_idx" ON "AiLearningHistory"("actorId", "createdAt");

-- CreateIndex
CREATE INDEX "AiLearningHistory_runId_idx" ON "AiLearningHistory"("runId");

-- AddForeignKey
ALTER TABLE "AiLearningHistory" ADD CONSTRAINT "AiLearningHistory_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
