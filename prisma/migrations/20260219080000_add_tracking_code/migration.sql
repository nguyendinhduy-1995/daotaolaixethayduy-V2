-- CreateEnum TrackingCodePlacement
CREATE TYPE "TrackingCodePlacement" AS ENUM ('HEAD', 'BODY_TOP', 'BODY_BOTTOM');

-- CreateEnum TrackingSite
CREATE TYPE "TrackingSite" AS ENUM ('GLOBAL', 'LANDING', 'CRM', 'STUDENT', 'TAPLAI');

-- CreateTable
CREATE TABLE "TrackingCode" (
    "id" TEXT NOT NULL,
    "site" "TrackingSite" NOT NULL DEFAULT 'GLOBAL',
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "placement" "TrackingCodePlacement" NOT NULL,
    "code" TEXT NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrackingCode_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TrackingCode_site_key_key" ON "TrackingCode"("site", "key");

-- CreateIndex
CREATE INDEX "TrackingCode_site_placement_isEnabled_idx" ON "TrackingCode"("site", "placement", "isEnabled");
