import { prisma } from "@/lib/prisma";
import { ensureNotificationSchema } from "@/lib/notifications-db";

export async function ensureOutboundSchema() {
  await ensureNotificationSchema();

  await prisma.$executeRawUnsafe(`
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'OutboundChannel') THEN
    CREATE TYPE "OutboundChannel" AS ENUM ('ZALO','FB','SMS','CALL_NOTE');
  END IF;
END $$;
`);

  await prisma.$executeRawUnsafe(`
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'OutboundStatus') THEN
    CREATE TYPE "OutboundStatus" AS ENUM ('QUEUED','SENT','FAILED','SKIPPED');
  END IF;
END $$;
`);

  await prisma.$executeRawUnsafe(`
CREATE TABLE IF NOT EXISTS "MessageTemplate" (
  "id" TEXT PRIMARY KEY,
  "key" TEXT NOT NULL UNIQUE,
  "title" TEXT NOT NULL,
  "channel" "OutboundChannel" NOT NULL,
  "body" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
`);

  await prisma.$executeRawUnsafe(`
CREATE TABLE IF NOT EXISTS "OutboundMessage" (
  "id" TEXT PRIMARY KEY,
  "channel" "OutboundChannel" NOT NULL,
  "to" TEXT,
  "templateKey" TEXT NOT NULL,
  "renderedText" TEXT NOT NULL,
  "status" "OutboundStatus" NOT NULL DEFAULT 'QUEUED',
  "error" TEXT,
  "leadId" TEXT,
  "studentId" TEXT,
  "notificationId" TEXT,
  "retryCount" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "sentAt" TIMESTAMP(3),
  CONSTRAINT "OutboundMessage_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "OutboundMessage_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "OutboundMessage_notificationId_fkey" FOREIGN KEY ("notificationId") REFERENCES "Notification"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
`);

  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "OutboundMessage_status_createdAt_idx" ON "OutboundMessage"("status","createdAt");`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "OutboundMessage_studentId_createdAt_idx" ON "OutboundMessage"("studentId","createdAt");`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "OutboundMessage_leadId_createdAt_idx" ON "OutboundMessage"("leadId","createdAt");`);
}

export async function ensureDefaultMessageTemplates() {
  await ensureOutboundSchema();

  const defaults = [
    {
      key: "remind_paid50",
      title: "Nhắc đóng tối thiểu 50%",
      channel: "SMS" as const,
      body: "Chào {{name}}, bạn cần hoàn tất tối thiểu 50% học phí. Vui lòng liên hệ {{ownerName}} để được hỗ trợ.",
    },
    {
      key: "remind_remaining",
      title: "Nhắc học phí còn lại",
      channel: "ZALO" as const,
      body: "Chào {{name}}, học phí còn lại của bạn là {{remaining}} đ. Vui lòng sắp xếp thanh toán trong hôm nay.",
    },
    {
      key: "remind_schedule",
      title: "Nhắc lịch học",
      channel: "FB" as const,
      body: "Xin chào {{name}}, bạn có lịch học vào {{scheduleAt}}. Vui lòng đến đúng giờ nhé.",
    },
  ];

  for (const tpl of defaults) {
    await prisma.messageTemplate.upsert({
      where: { key: tpl.key },
      update: { title: tpl.title, channel: tpl.channel, body: tpl.body, isActive: true },
      create: tpl,
    });
  }
}

export function renderTemplate(template: string, variables?: Record<string, unknown>) {
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key: string) => {
    const value = variables?.[key];
    if (value === undefined || value === null) return "";
    return String(value);
  });
}
