-- Forward-only alignment for OutboundMessage + related enums/relations.
-- Do not modify historical migrations that may already be deployed.

-- 1) Ensure enums exist
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'NotificationScope') THEN
    CREATE TYPE "NotificationScope" AS ENUM ('FINANCE','FOLLOWUP','SCHEDULE','SYSTEM');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'NotificationStatus') THEN
    CREATE TYPE "NotificationStatus" AS ENUM ('NEW','DOING','DONE','SKIPPED');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'NotificationPriority') THEN
    CREATE TYPE "NotificationPriority" AS ENUM ('HIGH','MEDIUM','LOW');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'OutboundChannel') THEN
    CREATE TYPE "OutboundChannel" AS ENUM ('ZALO','FB','SMS','CALL_NOTE');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'OutboundStatus') THEN
    CREATE TYPE "OutboundStatus" AS ENUM ('QUEUED','SENT','FAILED','SKIPPED');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'OutboundPriority') THEN
    CREATE TYPE "OutboundPriority" AS ENUM ('HIGH','MEDIUM','LOW');
  END IF;
END $$;

-- 2) Ensure related tables exist and match schema (idempotent)
CREATE TABLE IF NOT EXISTS "NotificationRule" (
  "id" TEXT NOT NULL,
  "scope" "NotificationScope" NOT NULL,
  "name" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "config" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "NotificationRule_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "NotificationRule"
  ADD COLUMN IF NOT EXISTS "id" TEXT,
  ADD COLUMN IF NOT EXISTS "scope" "NotificationScope",
  ADD COLUMN IF NOT EXISTS "name" TEXT,
  ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN,
  ADD COLUMN IF NOT EXISTS "config" JSONB,
  ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3);

DO $$ BEGIN
  ALTER TABLE "NotificationRule" ALTER COLUMN "id" SET NOT NULL;
  ALTER TABLE "NotificationRule" ALTER COLUMN "scope" SET NOT NULL;
  ALTER TABLE "NotificationRule" ALTER COLUMN "name" SET NOT NULL;
  ALTER TABLE "NotificationRule" ALTER COLUMN "isActive" SET NOT NULL;
  ALTER TABLE "NotificationRule" ALTER COLUMN "config" SET NOT NULL;
  ALTER TABLE "NotificationRule" ALTER COLUMN "createdAt" SET NOT NULL;
  ALTER TABLE "NotificationRule" ALTER COLUMN "updatedAt" SET NOT NULL;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

ALTER TABLE "NotificationRule"
  ALTER COLUMN "isActive" SET DEFAULT true,
  ALTER COLUMN "createdAt" SET DEFAULT CURRENT_TIMESTAMP;

DO $$ BEGIN
  ALTER TABLE "NotificationRule"
    ADD CONSTRAINT "NotificationRule_name_key" UNIQUE ("name");
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "MessageTemplate" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "channel" "OutboundChannel" NOT NULL,
  "body" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MessageTemplate_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "MessageTemplate"
  ADD COLUMN IF NOT EXISTS "id" TEXT,
  ADD COLUMN IF NOT EXISTS "key" TEXT,
  ADD COLUMN IF NOT EXISTS "title" TEXT,
  ADD COLUMN IF NOT EXISTS "channel" "OutboundChannel",
  ADD COLUMN IF NOT EXISTS "body" TEXT,
  ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN,
  ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3);

DO $$ BEGIN
  ALTER TABLE "MessageTemplate" ALTER COLUMN "id" SET NOT NULL;
  ALTER TABLE "MessageTemplate" ALTER COLUMN "key" SET NOT NULL;
  ALTER TABLE "MessageTemplate" ALTER COLUMN "title" SET NOT NULL;
  ALTER TABLE "MessageTemplate" ALTER COLUMN "channel" SET NOT NULL;
  ALTER TABLE "MessageTemplate" ALTER COLUMN "body" SET NOT NULL;
  ALTER TABLE "MessageTemplate" ALTER COLUMN "isActive" SET NOT NULL;
  ALTER TABLE "MessageTemplate" ALTER COLUMN "createdAt" SET NOT NULL;
  ALTER TABLE "MessageTemplate" ALTER COLUMN "updatedAt" SET NOT NULL;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

ALTER TABLE "MessageTemplate"
  ALTER COLUMN "isActive" SET DEFAULT true,
  ALTER COLUMN "createdAt" SET DEFAULT CURRENT_TIMESTAMP;

DO $$ BEGIN
  ALTER TABLE "MessageTemplate"
    ADD CONSTRAINT "MessageTemplate_key_key" UNIQUE ("key");
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "Notification" (
  "id" TEXT NOT NULL,
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
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Notification"
  ADD COLUMN IF NOT EXISTS "id" TEXT,
  ADD COLUMN IF NOT EXISTS "scope" "NotificationScope",
  ADD COLUMN IF NOT EXISTS "status" "NotificationStatus",
  ADD COLUMN IF NOT EXISTS "priority" "NotificationPriority",
  ADD COLUMN IF NOT EXISTS "title" TEXT,
  ADD COLUMN IF NOT EXISTS "message" TEXT,
  ADD COLUMN IF NOT EXISTS "payload" JSONB,
  ADD COLUMN IF NOT EXISTS "leadId" TEXT,
  ADD COLUMN IF NOT EXISTS "studentId" TEXT,
  ADD COLUMN IF NOT EXISTS "courseId" TEXT,
  ADD COLUMN IF NOT EXISTS "ownerId" TEXT,
  ADD COLUMN IF NOT EXISTS "dueAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3);

DO $$ BEGIN
  ALTER TABLE "Notification" ALTER COLUMN "id" SET NOT NULL;
  ALTER TABLE "Notification" ALTER COLUMN "scope" SET NOT NULL;
  ALTER TABLE "Notification" ALTER COLUMN "status" SET NOT NULL;
  ALTER TABLE "Notification" ALTER COLUMN "priority" SET NOT NULL;
  ALTER TABLE "Notification" ALTER COLUMN "title" SET NOT NULL;
  ALTER TABLE "Notification" ALTER COLUMN "message" SET NOT NULL;
  ALTER TABLE "Notification" ALTER COLUMN "createdAt" SET NOT NULL;
  ALTER TABLE "Notification" ALTER COLUMN "updatedAt" SET NOT NULL;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

ALTER TABLE "Notification"
  ALTER COLUMN "status" SET DEFAULT 'NEW',
  ALTER COLUMN "priority" SET DEFAULT 'MEDIUM',
  ALTER COLUMN "createdAt" SET DEFAULT CURRENT_TIMESTAMP;

DO $$ BEGIN
  ALTER TABLE "Notification"
    ADD CONSTRAINT "Notification_leadId_fkey"
      FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "Notification"
    ADD CONSTRAINT "Notification_studentId_fkey"
      FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "Notification"
    ADD CONSTRAINT "Notification_courseId_fkey"
      FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "Notification"
    ADD CONSTRAINT "Notification_ownerId_fkey"
      FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "Notification_scope_status_dueAt_idx" ON "Notification"("scope","status","dueAt");
CREATE INDEX IF NOT EXISTS "Notification_ownerId_createdAt_idx" ON "Notification"("ownerId","createdAt");
CREATE INDEX IF NOT EXISTS "Notification_studentId_scope_status_idx" ON "Notification"("studentId","scope","status");

-- 3) Align OutboundMessage to schema
CREATE TABLE IF NOT EXISTS "OutboundMessage" (
  "id" TEXT NOT NULL,
  "channel" "OutboundChannel" NOT NULL,
  "to" TEXT,
  "templateKey" TEXT NOT NULL,
  "renderedText" TEXT NOT NULL,
  "status" "OutboundStatus" NOT NULL DEFAULT 'QUEUED',
  "priority" "OutboundPriority" NOT NULL DEFAULT 'MEDIUM',
  "error" TEXT,
  "leadId" TEXT,
  "studentId" TEXT,
  "notificationId" TEXT,
  "retryCount" INTEGER NOT NULL DEFAULT 0,
  "nextAttemptAt" TIMESTAMP(3),
  "providerMessageId" TEXT,
  "leaseId" TEXT,
  "leaseExpiresAt" TIMESTAMP(3),
  "dispatchedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "sentAt" TIMESTAMP(3),
  CONSTRAINT "OutboundMessage_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "OutboundMessage"
  ADD COLUMN IF NOT EXISTS "id" TEXT,
  ADD COLUMN IF NOT EXISTS "channel" "OutboundChannel",
  ADD COLUMN IF NOT EXISTS "to" TEXT,
  ADD COLUMN IF NOT EXISTS "templateKey" TEXT,
  ADD COLUMN IF NOT EXISTS "renderedText" TEXT,
  ADD COLUMN IF NOT EXISTS "status" "OutboundStatus",
  ADD COLUMN IF NOT EXISTS "priority" "OutboundPriority",
  ADD COLUMN IF NOT EXISTS "error" TEXT,
  ADD COLUMN IF NOT EXISTS "leadId" TEXT,
  ADD COLUMN IF NOT EXISTS "studentId" TEXT,
  ADD COLUMN IF NOT EXISTS "notificationId" TEXT,
  ADD COLUMN IF NOT EXISTS "retryCount" INTEGER,
  ADD COLUMN IF NOT EXISTS "nextAttemptAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "providerMessageId" TEXT,
  ADD COLUMN IF NOT EXISTS "leaseId" TEXT,
  ADD COLUMN IF NOT EXISTS "leaseExpiresAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "dispatchedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "sentAt" TIMESTAMP(3);

DO $$ BEGIN
  ALTER TABLE "OutboundMessage" ALTER COLUMN "id" SET NOT NULL;
  ALTER TABLE "OutboundMessage" ALTER COLUMN "channel" SET NOT NULL;
  ALTER TABLE "OutboundMessage" ALTER COLUMN "templateKey" SET NOT NULL;
  ALTER TABLE "OutboundMessage" ALTER COLUMN "renderedText" SET NOT NULL;
  ALTER TABLE "OutboundMessage" ALTER COLUMN "status" SET NOT NULL;
  ALTER TABLE "OutboundMessage" ALTER COLUMN "priority" SET NOT NULL;
  ALTER TABLE "OutboundMessage" ALTER COLUMN "retryCount" SET NOT NULL;
  ALTER TABLE "OutboundMessage" ALTER COLUMN "createdAt" SET NOT NULL;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

ALTER TABLE "OutboundMessage"
  ALTER COLUMN "status" SET DEFAULT 'QUEUED',
  ALTER COLUMN "priority" SET DEFAULT 'MEDIUM',
  ALTER COLUMN "retryCount" SET DEFAULT 0,
  ALTER COLUMN "createdAt" SET DEFAULT CURRENT_TIMESTAMP;

DO $$ BEGIN
  ALTER TABLE "OutboundMessage"
    ADD CONSTRAINT "OutboundMessage_leadId_fkey"
      FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "OutboundMessage"
    ADD CONSTRAINT "OutboundMessage_studentId_fkey"
      FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "OutboundMessage"
    ADD CONSTRAINT "OutboundMessage_notificationId_fkey"
      FOREIGN KEY ("notificationId") REFERENCES "Notification"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "OutboundMessage_status_nextAttemptAt_idx" ON "OutboundMessage"("status","nextAttemptAt");
CREATE INDEX IF NOT EXISTS "OutboundMessage_leaseExpiresAt_idx" ON "OutboundMessage"("leaseExpiresAt");
CREATE INDEX IF NOT EXISTS "OutboundMessage_studentId_createdAt_idx" ON "OutboundMessage"("studentId","createdAt");
CREATE INDEX IF NOT EXISTS "OutboundMessage_leadId_createdAt_idx" ON "OutboundMessage"("leadId","createdAt");
