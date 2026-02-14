import { prisma } from "@/lib/prisma";

export async function ensureStudentPortalSchema() {
  await prisma.$executeRawUnsafe(`
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'StudentContentCategory') THEN
    CREATE TYPE "StudentContentCategory" AS ENUM ('HUONG_DAN','MEO_HOC','HO_SO','THI');
  END IF;
END $$;
`);

  await prisma.$executeRawUnsafe(`
CREATE TABLE IF NOT EXISTS "StudentAccount" (
  "id" TEXT PRIMARY KEY,
  "phone" TEXT NOT NULL UNIQUE,
  "passwordHash" TEXT NOT NULL,
  "studentId" TEXT NOT NULL UNIQUE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StudentAccount_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
`);

  await prisma.$executeRawUnsafe(`
CREATE TABLE IF NOT EXISTS "StudentContent" (
  "id" TEXT PRIMARY KEY,
  "category" "StudentContentCategory" NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "isPublished" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
`);

  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "StudentContent_category_isPublished_createdAt_idx" ON "StudentContent"("category","isPublished","createdAt");`);
}
