import { NextResponse } from "next/server";
import type { ExamResult, Prisma, StudyStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { jsonError } from "@/lib/api-response";
import { requireRouteAuth } from "@/lib/route-auth";
import { isAdminRole } from "@/lib/admin-auth";

const STUDY_STATUSES: StudyStatus[] = ["studying", "paused", "done"];
const EXAM_RESULTS: ExamResult[] = ["pass", "fail"];

function parsePositiveInt(value: string | null, fallback: number, max = 100) {
  if (value === null) return fallback;
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) throw new Error("INVALID_PAGINATION");
  return Math.min(n, max);
}

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

export async function GET(req: Request) {
  const authResult = requireRouteAuth(req);
  if (authResult.error) return authResult.error;

  try {
    const { searchParams } = new URL(req.url);
    const page = parsePositiveInt(searchParams.get("page"), 1);
    const pageSize = parsePositiveInt(searchParams.get("pageSize"), 20);
    const courseId = searchParams.get("courseId");
    const leadId = searchParams.get("leadId");
    const studyStatus = searchParams.get("studyStatus");
    const q = searchParams.get("q");

    if (studyStatus !== null && !isStudyStatus(studyStatus)) {
      return jsonError(400, "VALIDATION_ERROR", "Invalid studyStatus");
    }

    const leadFilter: Prisma.LeadWhereInput = {
      ...(!isAdminRole(authResult.auth.role) ? { ownerId: authResult.auth.sub } : {}),
      ...(q
        ? {
            OR: [{ fullName: { contains: q, mode: "insensitive" } }, { phone: { contains: q, mode: "insensitive" } }],
          }
        : {}),
    };

    const where: Prisma.StudentWhereInput = {
      ...(courseId ? { courseId } : {}),
      ...(leadId ? { leadId } : {}),
      ...(studyStatus ? { studyStatus } : {}),
      ...(Object.keys(leadFilter).length > 0 ? { lead: leadFilter } : {}),
    };

    const [items, total] = await Promise.all([
      prisma.student.findMany({
        where,
        include: {
          lead: { select: { id: true, fullName: true, phone: true, status: true } },
          course: { select: { id: true, code: true } },
          tuitionPlan: { select: { id: true, province: true, licenseType: true, tuition: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.student.count({ where }),
    ]);

    return NextResponse.json({ items, page, pageSize, total });
  } catch (error) {
    if (error instanceof Error && error.message === "INVALID_PAGINATION") {
      return jsonError(400, "VALIDATION_ERROR", "Invalid pagination");
    }
    return jsonError(500, "INTERNAL_ERROR", "Internal server error");
  }
}

export async function POST(req: Request) {
  const authResult = requireRouteAuth(req);
  if (authResult.error) return authResult.error;

  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return jsonError(400, "VALIDATION_ERROR", "Invalid JSON body");
    }
    if (!body.leadId || typeof body.leadId !== "string") {
      return jsonError(400, "VALIDATION_ERROR", "leadId is required");
    }
    if (body.studyStatus !== undefined && !isStudyStatus(body.studyStatus)) {
      return jsonError(400, "VALIDATION_ERROR", "Invalid studyStatus");
    }
    if (body.examResult !== undefined && body.examResult !== null && !isExamResult(body.examResult)) {
      return jsonError(400, "VALIDATION_ERROR", "Invalid examResult");
    }

    const lead = await prisma.lead.findUnique({
      where: { id: body.leadId },
      select: { id: true, ownerId: true },
    });
    if (!lead) return jsonError(404, "NOT_FOUND", "Lead not found");
    if (!isAdminRole(authResult.auth.role) && lead.ownerId !== authResult.auth.sub) {
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

    const student = await prisma.student.create({
      data: {
        leadId: body.leadId,
        courseId: typeof body.courseId === "string" ? body.courseId : null,
        tuitionPlanId: typeof body.tuitionPlanId === "string" ? body.tuitionPlanId : null,
        tuitionSnapshot: typeof body.tuitionSnapshot === "number" ? body.tuitionSnapshot : null,
        signedAt: parseDate(body.signedAt) ?? null,
        arrivedAt: parseDate(body.arrivedAt) ?? null,
        studyStatus: isStudyStatus(body.studyStatus) ? body.studyStatus : undefined,
        examDate: parseDate(body.examDate) ?? null,
        examStatus: typeof body.examStatus === "string" ? body.examStatus : null,
        examResult: body.examResult === null ? null : isExamResult(body.examResult) ? body.examResult : null,
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
