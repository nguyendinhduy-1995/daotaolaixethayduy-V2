import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError } from "@/lib/api-response";
import { requireStudentAuth, StudentAuthError } from "@/lib/student-auth";
import { ensureStudentPortalSchema } from "@/lib/student-portal-db";

export async function GET(req: Request) {
  let auth;
  try {
    auth = requireStudentAuth(req);
  } catch (error) {
    if (error instanceof StudentAuthError) {
      return jsonError(error.status, error.code, error.message);
    }
    return jsonError(401, "AUTH_INVALID_TOKEN", "Unauthorized");
  }

  try {
    await ensureStudentPortalSchema();
    const student = await prisma.student.findUnique({
      where: { id: auth.studentId },
      include: {
        lead: true,
        course: true,
        tuitionPlan: true,
      },
    });
    if (!student) return jsonError(404, "NOT_FOUND", "Student not found");

    const agg = await prisma.receipt.aggregate({
      where: { studentId: student.id },
      _sum: { amount: true },
    });
    const tuitionTotal = student.tuitionSnapshot ?? student.tuitionPlan?.tuition ?? 0;
    const paid = agg._sum.amount ?? 0;
    const remaining = Math.max(0, tuitionTotal - paid);
    const paid50 = tuitionTotal > 0 ? paid >= Math.floor(tuitionTotal * 0.5) : false;

    const supportOwner = student.lead.ownerId
      ? await prisma.user.findUnique({
          where: { id: student.lead.ownerId },
          select: { id: true, name: true, email: true },
        })
      : null;

    const now = new Date();
    const next30d = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const upcomingSchedule = student.courseId
      ? await prisma.courseScheduleItem.findMany({
          where: {
            courseId: student.courseId,
            isActive: true,
            startAt: { gte: now, lte: next30d },
          },
          orderBy: { startAt: "asc" },
          take: 20,
        })
      : [];

    const contentHighlights = await prisma.studentContent.findMany({
      where: { isPublished: true },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, category: true, title: true, createdAt: true },
    });

    return NextResponse.json({
      student: {
        id: student.id,
        fullName: student.lead.fullName,
        phone: student.lead.phone,
        course: student.course ? { id: student.course.id, code: student.course.code } : null,
        studyStatus: student.studyStatus,
      },
      finance: {
        totalTuition: tuitionTotal,
        paid,
        remaining,
        paid50,
      },
      support: supportOwner
        ? {
            id: supportOwner.id,
            name: supportOwner.name,
            email: supportOwner.email,
            phone: student.lead.phone,
          }
        : null,
      schedule: upcomingSchedule.map((s) => ({
        id: s.id,
        title: s.title,
        type: s.type,
        startAt: s.startAt,
        endAt: s.endAt,
      })),
      exam: student.examDate
        ? {
            examDate: student.examDate,
            examStatus: student.examStatus,
            examResult: student.examResult,
          }
        : null,
      tuitionPlan: student.tuitionPlan
        ? {
            id: student.tuitionPlan.id,
            province: student.tuitionPlan.province,
            licenseType: student.tuitionPlan.licenseType,
            tuition: student.tuitionPlan.tuition,
          }
        : null,
      contentHighlights,
    });
  } catch {
    return jsonError(500, "INTERNAL_ERROR", "Internal server error");
  }
}
