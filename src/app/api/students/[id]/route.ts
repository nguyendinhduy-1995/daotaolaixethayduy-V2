import { NextResponse } from "next/server";
import type { ExamResult, StudyStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { jsonError } from "@/lib/api-response";
import { requireRouteAuth } from "@/lib/route-auth";
import { isTelesalesRole } from "@/lib/admin-auth";

type RouteContext = { params: Promise<{ id: string }> | { id: string } };

const STUDY_STATUSES: StudyStatus[] = ["studying", "paused", "done"];
const EXAM_RESULTS: ExamResult[] = ["pass", "fail"];

function parseDate(value: unknown) {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  if (typeof value !== "string") throw new Error("INVALID_DATE");
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) throw new Error("INVALID_DATE");
  return d;
}

function isStudyStatus(value: unknown): value is StudyStatus {
  return typeof value === "string" && STUDY_STATUSES.includes(value as StudyStatus);
}

function isExamResult(value: unknown): value is ExamResult {
  return typeof value === "string" && EXAM_RESULTS.includes(value as ExamResult);
}

export async function GET(req: Request, context: RouteContext) {
  const authResult = requireRouteAuth(req);
  if (authResult.error) return authResult.error;

  try {
    const { id } = await Promise.resolve(context.params);
    const student = await prisma.student.findUnique({
      where: { id },
      include: {
        lead: { select: { id: true, fullName: true, phone: true, status: true, ownerId: true } },
        course: { select: { id: true, code: true } },
        tuitionPlan: { select: { id: true, province: true, licenseType: true, tuition: true } },
      },
    });

    if (!student) return jsonError(404, "NOT_FOUND", "Student not found");
    if (isTelesalesRole(authResult.auth.role) && student.lead.ownerId !== authResult.auth.sub) {
      return jsonError(403, "AUTH_FORBIDDEN", "Forbidden");
    }
    return NextResponse.json({ student });
  } catch {
    return jsonError(500, "INTERNAL_ERROR", "Internal server error");
  }
}

export async function PATCH(req: Request, context: RouteContext) {
  const authResult = requireRouteAuth(req);
  if (authResult.error) return authResult.error;

  try {
    const { id } = await Promise.resolve(context.params);
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return jsonError(400, "VALIDATION_ERROR", "Invalid JSON body");
    }
    if (body.studyStatus !== undefined && !isStudyStatus(body.studyStatus)) {
      return jsonError(400, "VALIDATION_ERROR", "Invalid studyStatus");
    }
    if (body.examResult !== undefined && body.examResult !== null && !isExamResult(body.examResult)) {
      return jsonError(400, "VALIDATION_ERROR", "Invalid examResult");
    }

    const exists = await prisma.student.findUnique({
      where: { id },
      select: { id: true, lead: { select: { ownerId: true } } },
    });
    if (!exists) return jsonError(404, "NOT_FOUND", "Student not found");
    if (isTelesalesRole(authResult.auth.role) && exists.lead.ownerId !== authResult.auth.sub) {
      return jsonError(403, "AUTH_FORBIDDEN", "Forbidden");
    }

    if (body.courseId) {
      const course = await prisma.course.findUnique({ where: { id: body.courseId }, select: { id: true } });
      if (!course) return jsonError(404, "NOT_FOUND", "Course not found");
    }
    if (body.tuitionPlanId) {
      const plan = await prisma.tuitionPlan.findUnique({
        where: { id: body.tuitionPlanId },
        select: { id: true },
      });
      if (!plan) return jsonError(404, "NOT_FOUND", "Tuition plan not found");
    }

    const student = await prisma.student.update({
      where: { id },
      data: {
        ...(body.courseId !== undefined ? { courseId: typeof body.courseId === "string" ? body.courseId : null } : {}),
        ...(body.tuitionPlanId !== undefined
          ? { tuitionPlanId: typeof body.tuitionPlanId === "string" ? body.tuitionPlanId : null }
          : {}),
        ...(body.tuitionSnapshot !== undefined
          ? { tuitionSnapshot: typeof body.tuitionSnapshot === "number" ? body.tuitionSnapshot : null }
          : {}),
        ...(body.signedAt !== undefined ? { signedAt: parseDate(body.signedAt) } : {}),
        ...(body.arrivedAt !== undefined ? { arrivedAt: parseDate(body.arrivedAt) } : {}),
        ...(body.studyStatus !== undefined ? { studyStatus: body.studyStatus } : {}),
        ...(body.examDate !== undefined ? { examDate: parseDate(body.examDate) } : {}),
        ...(body.examStatus !== undefined
          ? { examStatus: typeof body.examStatus === "string" ? body.examStatus : null }
          : {}),
        ...(body.examResult !== undefined ? { examResult: body.examResult } : {}),
      },
    });

    return NextResponse.json({ student });
  } catch (error) {
    if (error instanceof Error && error.message === "INVALID_DATE") {
      return jsonError(400, "VALIDATION_ERROR", "Invalid date");
    }
    return jsonError(500, "INTERNAL_ERROR", "Internal server error");
  }
}
