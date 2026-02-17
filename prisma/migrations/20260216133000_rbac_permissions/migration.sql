-- CreateEnum
CREATE TYPE "PermissionModule" AS ENUM (
  'overview',
  'leads',
  'leads_board',
  'kpi_daily',
  'students',
  'courses',
  'schedule',
  'receipts',
  'notifications',
  'messaging',
  'my_payroll',
  'ops_ai_hr',
  'ops_n8n',
  'automation_logs',
  'automation_run',
  'marketing_meta_ads',
  'admin_branches',
  'admin_users',
  'admin_segments',
  'admin_tuition',
  'admin_notification_admin',
  'admin_automation_admin',
  'admin_send_progress',
  'admin_plans',
  'admin_student_content',
  'hr_kpi',
  'hr_payroll_profiles',
  'hr_attendance',
  'hr_total_payroll',
  'api_hub'
);

-- CreateEnum
CREATE TYPE "PermissionAction" AS ENUM (
  'VIEW',
  'CREATE',
  'UPDATE',
  'DELETE',
  'EXPORT',
  'ASSIGN',
  'RUN'
);

-- AlterTable
ALTER TABLE "User" ADD COLUMN "groupId" TEXT;

-- CreateTable
CREATE TABLE "PermissionGroup" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "isSystem" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PermissionGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PermissionRule" (
  "id" TEXT NOT NULL,
  "groupId" TEXT NOT NULL,
  "module" "PermissionModule" NOT NULL,
  "action" "PermissionAction" NOT NULL,
  "allowed" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PermissionRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserPermissionOverride" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "module" "PermissionModule" NOT NULL,
  "action" "PermissionAction" NOT NULL,
  "allowed" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "UserPermissionOverride_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PermissionGroup_name_key" ON "PermissionGroup"("name");

-- CreateIndex
CREATE UNIQUE INDEX "PermissionRule_groupId_module_action_key" ON "PermissionRule"("groupId", "module", "action");
CREATE INDEX "PermissionRule_groupId_module_idx" ON "PermissionRule"("groupId", "module");

-- CreateIndex
CREATE UNIQUE INDEX "UserPermissionOverride_userId_module_action_key" ON "UserPermissionOverride"("userId", "module", "action");
CREATE INDEX "UserPermissionOverride_userId_module_idx" ON "UserPermissionOverride"("userId", "module");
CREATE INDEX "User_groupId_idx" ON "User"("groupId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "PermissionGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PermissionRule" ADD CONSTRAINT "PermissionRule_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "PermissionGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserPermissionOverride" ADD CONSTRAINT "UserPermissionOverride_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
