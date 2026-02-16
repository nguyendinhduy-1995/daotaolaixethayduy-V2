/*
  Warnings:

  - A unique constraint covering the columns `[suggestionId,userId]` on the table `AiSuggestionFeedback` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "AiSuggestionFeedbackType" AS ENUM ('HELPFUL', 'NOT_HELPFUL', 'DONE');

-- AlterEnum
ALTER TYPE "PermissionAction" ADD VALUE 'FEEDBACK';

-- AlterEnum
ALTER TYPE "PermissionModule" ADD VALUE 'ai_suggestions';

-- DropIndex
DROP INDEX "AiSuggestionFeedback_suggestionId_createdAt_idx";

-- AlterTable
ALTER TABLE "AiSuggestionFeedback" ADD COLUMN     "actualResult" JSONB,
ADD COLUMN     "feedbackType" "AiSuggestionFeedbackType" NOT NULL DEFAULT 'HELPFUL',
ADD COLUMN     "reason" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "reasonDetail" TEXT;

-- Backfill dữ liệu cũ sang định dạng phản hồi mới
UPDATE "AiSuggestionFeedback"
SET
  "feedbackType" = CASE
    WHEN "applied" = true THEN 'HELPFUL'::"AiSuggestionFeedbackType"
    ELSE 'NOT_HELPFUL'::"AiSuggestionFeedbackType"
  END,
  "reason" = CASE
    WHEN "applied" = true THEN 'de_lam_theo'
    ELSE 'chua_sat_thuc_te'
  END;

-- CreateIndex
CREATE INDEX "AiSuggestionFeedback_suggestionId_feedbackType_createdAt_idx" ON "AiSuggestionFeedback"("suggestionId", "feedbackType", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AiSuggestionFeedback_suggestionId_userId_key" ON "AiSuggestionFeedback"("suggestionId", "userId");
