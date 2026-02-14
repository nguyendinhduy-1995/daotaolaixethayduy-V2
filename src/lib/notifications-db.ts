import { prisma } from "@/lib/prisma";

export async function ensureNotificationSchema() {
  await prisma.$executeRawUnsafe(`
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'NotificationScope') THEN
    CREATE TYPE "NotificationScope" AS ENUM ('FINANCE','FOLLOWUP','SCHEDULE','SYSTEM');
  END IF;
END $$;
`);

  await prisma.$executeRawUnsafe(`
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'NotificationStatus') THEN
    CREATE TYPE "NotificationStatus" AS ENUM ('NEW','DOING','DONE','SKIPPED');
  END IF;
END $$;
`);

  await prisma.$executeRawUnsafe(`
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'NotificationPriority') THEN
    CREATE TYPE "NotificationPriority" AS ENUM ('HIGH','MEDIUM','LOW');
  END IF;
END $$;
`);

  await prisma.$executeRawUnsafe(`
CREATE TABLE IF NOT EXISTS "Notification" (
  "id" TEXT PRIMARY KEY,
  "scope" "NotificationScope" NOT NULL,
  "status" "NotificationStatus" NOT NULL DEFAULT 'NEW',
  "priority" "NotificationPriority" NOT NULL DEFAULT 'MEDIUM',
  "title" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "payload" JSONB,
  "leadId" TEXT,
  "studentId" TEXT,
  "courseId" TEXT,
  "ownerId" TEXT,
  "dueAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Notification_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "Notification_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "Notification_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "Notification_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
`);

  await prisma.$executeRawUnsafe(`
CREATE TABLE IF NOT EXISTS "NotificationRule" (
  "id" TEXT PRIMARY KEY,
  "scope" "NotificationScope" NOT NULL,
  "name" TEXT NOT NULL UNIQUE,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "config" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
`);

  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Notification_scope_status_dueAt_idx" ON "Notification"("scope","status","dueAt");`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Notification_ownerId_createdAt_idx" ON "Notification"("ownerId","createdAt");`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Notification_studentId_scope_status_idx" ON "Notification"("studentId","scope","status");`);
}

export async function ensureDefaultNotificationRules() {
  await ensureNotificationSchema();
  await prisma.notificationRule.upsert({
    where: { name: "finance-default" },
    update: {
      scope: "FINANCE",
      isActive: true,
      config: {
        dueInDays: 0,
        highPriorityAfterDays: 7,
        mediumPriorityNoReceiptDays: 14,
        dedupeDays: 3,
      },
    },
    create: {
      name: "finance-default",
      scope: "FINANCE",
      isActive: true,
      config: {
        dueInDays: 0,
        highPriorityAfterDays: 7,
        mediumPriorityNoReceiptDays: 14,
        dedupeDays: 3,
      },
    },
  });
}
