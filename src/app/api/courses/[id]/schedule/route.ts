import { NextResponse } from "next/server";
import type { Prisma, ScheduleType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { jsonError } from "@/lib/api-response";
import { API_ERROR_VI } from "@/lib/api-error-vi";
import { requireMappedRoutePermissionAuth } from "@/lib/route-auth";
import { resolveWriteBranchId } from "@/lib/scope";

type RouteContext = { params: Promise<{ id: string }> | { id: string } };

const SCHEDULE_TYPES: ScheduleType[] = ["study", "exam", "reminder"];

function parseDate(value: unknown) {
  if (typeof value !== "string") throw new Error("INVALID_DATE");
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) throw new Error("INVALID_DATE");
  return d;
}

function parseOptionalDate(value: unknown) {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  return parseDate(value);
}

function isScheduleType(value: unknown): value is ScheduleType {
  return typeof value === "string" && SCHEDULE_TYPES.includes(value as ScheduleType);
}

export async function GET(req: Request, context: RouteContext) {
  const authResult = await requireMappedRoutePermissionAuth(req);
  if (authResult.error) return authResult.error;

  try {
    const { id } = await Promise.resolve(context.params);
    const { searchParams } = new URL(req.url);
    const onlyActive = searchParams.get("isActive");

    const course = await prisma.course.findUnique({ where: { id }, select: { id: true } });
    if (!course) return jsonError(404, "NOT_FOUND", API_ERROR_VI.required);

    let activeFilter: boolean | undefined;
    if (onlyActive !== null) {
      if (onlyActive !== "true" && onlyActive !== "false") {
        return jsonError(400, "VALIDATION_ERROR", "Invalid isActive filter");
      }
      activeFilter = onlyActive === "true";
    }

    const where: Prisma.CourseScheduleItemWhereInput = {
      courseId: id,
      ...(activeFilter !== undefined ? { isActive: activeFilter } : {}),
    };

    const items = await prisma.courseScheduleItem.findMany({
      where,
      orderBy: { startAt: "asc" },
    });

    return NextResponse.json({ items });
  } catch {
    return jsonError(500, "INTERNAL_ERROR", API_ERROR_VI.internal);
  }
}

export async function POST(req: Request, context: RouteContext) {
  const authResult = await requireMappedRoutePermissionAuth(req);
  if (authResult.error) return authResult.error;

  try {
    const { id } = await Promise.resolve(context.params);
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return jsonError(400, "VALIDATION_ERROR", API_ERROR_VI.required);
    }
    if (!isScheduleType(body.type)) {
      return jsonError(400, "VALIDATION_ERROR", API_ERROR_VI.required);
    }
    if (!body.title || typeof body.title !== "string") {
      return jsonError(400, "VALIDATION_ERROR", API_ERROR_VI.required);
    }
    if (!body.startAt) {
      return jsonError(400, "VALIDATION_ERROR", API_ERROR_VI.required);
    }

    const course = await prisma.course.findUnique({ where: { id }, select: { id: true } });
    if (!course) return jsonError(404, "NOT_FOUND", API_ERROR_VI.required);

    const ruleMeta =
      body.rule && typeof body.rule === "object" && !Array.isArray(body.rule)
        ? (body.rule as Record<string, unknown>)
        : {};
    const location = typeof ruleMeta.location === "string" ? ruleMeta.location : null;
    const note = typeof ruleMeta.note === "string" ? ruleMeta.note : null;
    const statusRaw = typeof ruleMeta.status === "string" ? ruleMeta.status : "PLANNED";
    const status =
      statusRaw === "done" || statusRaw === "DONE"
        ? "DONE"
        : statusRaw === "cancelled" || statusRaw === "CANCELLED"
          ? "CANCELLED"
          : "PLANNED";

    const courseBranch = await prisma.student.findFirst({
      where: { courseId: id },
      select: { branchId: true },
      orderBy: { createdAt: "asc" },
    });
    const branchId = await resolveWriteBranchId(authResult.auth, [courseBranch?.branchId]);

    const item = await prisma.courseScheduleItem.create({
      data: {
        courseId: id,
        branchId,
        type: body.type,
        title: body.title,
        startAt: parseDate(body.startAt),
        endAt: parseOptionalDate(body.endAt) ?? null,
        source: "MANUAL",
        status,
        location,
        note,
        rule: body.rule ?? null,
        isActive: typeof body.isActive === "boolean" ? body.isActive : status !== "CANCELLED",
      },
    });

    return NextResponse.json({ item });
  } catch (error) {
    if (error instanceof Error && error.message === "INVALID_DATE") {
      return jsonError(400, "VALIDATION_ERROR", API_ERROR_VI.required);
    }
    return jsonError(500, "INTERNAL_ERROR", API_ERROR_VI.internal);
  }
}
