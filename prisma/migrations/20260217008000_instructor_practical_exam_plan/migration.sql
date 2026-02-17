-- CreateEnum
CREATE TYPE "InstructorStatus" AS ENUM ('ACTIVE', 'INACTIVE');
CREATE TYPE "LessonType" AS ENUM ('SA_HINH', 'DUONG_TRUONG', 'DAT', 'CABIN', 'OTHER');
CREATE TYPE "LessonStatus" AS ENUM ('SCHEDULED', 'DONE', 'CANCELED', 'NO_SHOW');

-- CreateTable Instructor
CREATE TABLE "Instructor" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "status" "InstructorStatus" NOT NULL DEFAULT 'ACTIVE'::"InstructorStatus",
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Instructor_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Instructor_phone_key" ON "Instructor"("phone");
CREATE INDEX "Instructor_status_createdAt_idx" ON "Instructor"("status", "createdAt");

-- AlterTable Student: add instructorId
ALTER TABLE "Student" ADD COLUMN "instructorId" TEXT;
CREATE INDEX "Student_instructorId_idx" ON "Student"("instructorId");
ALTER TABLE "Student" ADD CONSTRAINT "Student_instructorId_fkey" FOREIGN KEY ("instructorId") REFERENCES "Instructor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable PracticalLesson
CREATE TABLE "PracticalLesson" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "instructorId" TEXT NOT NULL,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3),
    "location" TEXT,
    "lessonType" "LessonType" NOT NULL,
    "status" "LessonStatus" NOT NULL DEFAULT 'SCHEDULED'::"LessonStatus",
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PracticalLesson_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "PracticalLesson_instructorId_startAt_idx" ON "PracticalLesson"("instructorId", "startAt");
CREATE INDEX "PracticalLesson_studentId_startAt_idx" ON "PracticalLesson"("studentId", "startAt");
ALTER TABLE "PracticalLesson" ADD CONSTRAINT "PracticalLesson_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PracticalLesson" ADD CONSTRAINT "PracticalLesson_instructorId_fkey" FOREIGN KEY ("instructorId") REFERENCES "Instructor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable StudentExamPlan
CREATE TABLE "StudentExamPlan" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "estimatedGraduationAt" TIMESTAMP(3),
    "estimatedExamAt" TIMESTAMP(3),
    "note" TEXT,
    "updatedByUserId" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "StudentExamPlan_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "StudentExamPlan_studentId_key" ON "StudentExamPlan"("studentId");
CREATE INDEX "StudentExamPlan_studentId_idx" ON "StudentExamPlan"("studentId");
ALTER TABLE "StudentExamPlan" ADD CONSTRAINT "StudentExamPlan_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;
