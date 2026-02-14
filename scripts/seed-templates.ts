import "dotenv/config";
import { prisma } from "./prisma.ts";

async function ensureOutboundSchemaForSeed() {
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
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
`);
  await prisma.$executeRawUnsafe(`
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'OutboundChannel') THEN
    CREATE TYPE "OutboundChannel" AS ENUM ('ZALO','FB','SMS','CALL_NOTE');
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
}

async function main() {
  await ensureOutboundSchemaForSeed();

  await prisma.messageTemplate.upsert({
    where: { key: "remind_paid50" },
    update: {
      title: "Nhắc đóng tối thiểu 50%",
      channel: "SMS",
      body: "Chào {{name}}, bạn cần hoàn tất tối thiểu 50% học phí. Vui lòng liên hệ {{ownerName}} để được hỗ trợ.",
      isActive: true,
    },
    create: {
      key: "remind_paid50",
      title: "Nhắc đóng tối thiểu 50%",
      channel: "SMS",
      body: "Chào {{name}}, bạn cần hoàn tất tối thiểu 50% học phí. Vui lòng liên hệ {{ownerName}} để được hỗ trợ.",
      isActive: true,
    },
  });

  await prisma.messageTemplate.upsert({
    where: { key: "remind_remaining" },
    update: {
      title: "Nhắc học phí còn lại",
      channel: "ZALO",
      body: "Chào {{name}}, học phí còn lại của bạn là {{remaining}} đ. Vui lòng sắp xếp thanh toán trong hôm nay.",
      isActive: true,
    },
    create: {
      key: "remind_remaining",
      title: "Nhắc học phí còn lại",
      channel: "ZALO",
      body: "Chào {{name}}, học phí còn lại của bạn là {{remaining}} đ. Vui lòng sắp xếp thanh toán trong hôm nay.",
      isActive: true,
    },
  });

  await prisma.messageTemplate.upsert({
    where: { key: "remind_schedule" },
    update: {
      title: "Nhắc lịch học",
      channel: "FB",
      body: "Xin chào {{name}}, bạn có lịch học vào {{scheduleAt}}. Vui lòng đến đúng giờ nhé.",
      isActive: true,
    },
    create: {
      key: "remind_schedule",
      title: "Nhắc lịch học",
      channel: "FB",
      body: "Xin chào {{name}}, bạn có lịch học vào {{scheduleAt}}. Vui lòng đến đúng giờ nhé.",
      isActive: true,
    },
  });

  console.log("✅ Seeded templates");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
