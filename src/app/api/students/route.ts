import { NextResponse } from "next/server";
import type { ExamResult, Prisma, StudyStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { jsonError } from "@/lib/api-response";
import { requireMappedRoutePermissionAuth } from "@/lib/route-auth";
import { API_ERROR_VI } from "@/lib/api-error-vi";
import { applyScopeToWhere, resolveScope, resolveWriteBranchId } from "@/lib/scope";

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
  const authResult = await requireMappedRoutePermissionAuth(req);
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
      return jsonError(400, "VALIDATION_ERROR", API_ERROR_VI.required);
    }

    const scope = await resolveScope(authResult.auth);
    const leadFilter: Prisma.LeadWhereInput = {
      ...(q
        ? {
            OR: [{ fullName: { contains: q, mode: "insensitive" } }, { phone: { contains: q, mode: "insensitive" } }],
          }
        : {}),
    };

    const whereBase: Prisma.StudentWhereInput = {
      ...(courseId ? { courseId } : {}),
      ...(leadId ? { leadId } : {}),
      ...(studyStatus ? { studyStatus } : {}),
      ...(Object.keys(leadFilter).length > 0 ? { lead: leadFilter } : {}),
    };
    const where = applyScopeToWhere(whereBase, scope, "student");

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
      return jsonError(400, "VALIDATION_ERROR", API_ERROR_VI.required);
    }
    return jsonError(500, "INTERNAL_ERROR", API_ERROR_VI.internal);
  }
}

export async function POST(req: Request) {
  const authResult = await requireMappedRoutePermissionAuth(req);
  if (authResult.error) return authResult.error;

  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return jsonError(400, "VALIDATION_ERROR", API_ERROR_VI.required);
    }
    if (!body.leadId || typeof body.leadId !== "string") {
      return jsonError(400, "VALIDATION_ERROR", API_ERROR_VI.required);
    }
    if (body.studyStatus !== undefined && !isStudyStatus(body.studyStatus)) {
      return jsonError(400, "VALIDATION_ERROR", API_ERROR_VI.required);
    }
    if (body.examResult !== undefined && body.examResult !== null && !isExamResult(body.examResult)) {
      return jsonError(400, "VALIDATION_ERROR", API_ERROR_VI.required);
    }

    const scope = await resolveScope(authResult.auth);
    const lead = await prisma.lead.findUnique({
      where: { id: body.leadId },
      select: { id: true, ownerId: true, branchId: true, owner: { select: { branchId: true } } },
    });
    if (!lead) return jsonError(404, "NOT_FOUND", API_ERROR_VI.notFoundLead);
    const scopedLead = await prisma.lead.findFirst({
      where: applyScopeToWhere({ id: body.leadId }, scope, "lead"),
      select: { id: true },
    });
    if (!scopedLead) {
      return jsonError(403, "AUTH_FORBIDDEN", API_ERROR_VI.forbidden);
    }

    if (body.courseId) {
      const course = await prisma.course.findUnique({ where: { id: body.courseId }, select: { id: true } });
      if (!course) return jsonError(404, "NOT_FOUND", API_ERROR_VI.required);
    }
    if (body.tuitionPlanId) {
      const plan = await prisma.tuitionPlan.findUnique({
        where: { id: body.tuitionPlanId },
        select: { id: true },
      });
      if (!plan) return jsonError(404, "NOT_FOUND", API_ERROR_VI.required);
    }

    const branchId = await resolveWriteBranchId(authResult.auth, [lead.branchId, lead.owner?.branchId ?? null]);
    const student = await prisma.student.create({
      data: {
        leadId: body.leadId,
        branchId,
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
      return jsonError(400, "VALIDATION_ERROR", API_ERROR_VI.required);
    }
    return jsonError(500, "INTERNAL_ERROR", API_ERROR_VI.internal);
  }
}
