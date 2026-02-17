import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { jsonError } from "@/lib/api-response";
import { API_ERROR_VI } from "@/lib/api-error-vi";
import { requirePermissionRouteAuth } from "@/lib/route-auth";
import { ensureAttendanceSchema } from "@/lib/attendance-db";
import { buildScheduleScopeWhere, extractScheduleMeta, requireScheduleRole, resolveScheduleStatus } from "@/lib/services/schedule";

type RouteContext = { params: Promise<{ id: string }> | { id: string } };
const STATUS_MAP: Record<string, "PLANNED" | "DONE" | "CANCELLED"> = {
  planned: "PLANNED",
  done: "DONE",
  cancelled: "CANCELLED",
  PLANNED: "PLANNED",
  DONE: "DONE",
  CANCELLED: "CANCELLED",
};

function parseDate(value: unknown) {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  if (typeof value !== "string") throw new Error("INVALID_DATE");
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) throw new Error("INVALID_DATE");
  return d;
}

function nextRule(rule: unknown, patch: { location?: string | null; note?: string | null; status?: string | null }) {
  const base =
    rule && typeof rule === "object" && !Array.isArray(rule) ? { ...(rule as Record<string, unknown>) } : {};
  if (patch.location !== undefined) base.location = patch.location;
  if (patch.note !== undefined) base.note = patch.note;
  if (patch.status !== undefined) base.status = patch.status;
  return base as Prisma.InputJsonValue;
}

export async function GET(req: Request, context: RouteContext) {
  const authResult = await requirePermissionRouteAuth(req, { module: "schedule", action: "VIEW" });
  if (authResult.error) return authResult.error;
  const roleError = requireScheduleRole(authResult.auth.role);
  if (roleError) return roleError;

  try {
    await ensureAttendanceSchema();
    const { id } = await Promise.resolve(context.params);
    const scopeWhere = await buildScheduleScopeWhere(authResult.auth);

    const item = await prisma.courseScheduleItem.findFirst({
      where: { id, ...scopeWhere },
      include: {
        course: { select: { id: true, code: true, province: true, licenseType: true } },
      },
    });
    if (!item) return jsonError(404, "NOT_FOUND", API_ERROR_VI.required);

    const students = await prisma.student.findMany({
      where: {
        courseId: item.courseId,
        ...(authResult.auth.role === "telesales" ? { lead: { ownerId: authResult.auth.sub } } : {}),
      },
      include: {
        lead: { select: { id: true, fullName: true, phone: true, ownerId: true } },
      },
      orderBy: { createdAt: "asc" },
    });

    const [records, audits] = await Promise.all([
      prisma.attendanceRecord.findMany({
        where: { scheduleItemId: item.id },
        include: {
          student: { include: { lead: { select: { fullName: true, phone: true } } } },
          updatedBy: { select: { id: true, name: true, email: true } },
        },
        orderBy: { createdAt: "asc" },
      }),
      prisma.attendanceAudit.findMany({
        where: { scheduleItemId: item.id },
        include: { actor: { select: { id: true, name: true, email: true } } },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
    ]);

    return NextResponse.json({
      item: {
        ...item,
        meta: extractScheduleMeta(item.rule, {
          location: item.location,
          note: item.note,
          status: item.status,
          source: item.source,
        }),
        scheduleStatus: resolveScheduleStatus(item),
      },
      students,
      attendance: records,
      audits,
    });
  } catch {
    return jsonError(500, "INTERNAL_ERROR", API_ERROR_VI.internal);
  }
}

export async function PATCH(req: Request, context: RouteContext) {
  const authResult = await requirePermissionRouteAuth(req, { module: "schedule", action: "UPDATE" });
  if (authResult.error) return authResult.error;
  const roleError = requireScheduleRole(authResult.auth.role);
  if (roleError) return roleError;

  try {
    await ensureAttendanceSchema();
    const { id } = await Promise.resolve(context.params);
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return jsonError(400, "VALIDATION_ERROR", API_ERROR_VI.required);
    }

    const scopeWhere = await buildScheduleScopeWhere(authResult.auth);
    const item = await prisma.courseScheduleItem.findFirst({
      where: { id, ...scopeWhere },
      select: { id: true, rule: true },
    });
    if (!item) return jsonError(404, "NOT_FOUND", API_ERROR_VI.required);

    const data: Prisma.CourseScheduleItemUpdateInput = {};
    if (body.startAt !== undefined) {
      const startAt = parseDate(body.startAt);
      if (!startAt) return jsonError(400, "VALIDATION_ERROR", API_ERROR_VI.required);
      data.startAt = startAt;
    }
    if (body.endAt !== undefined) {
      data.endAt = parseDate(body.endAt);
    }
    if (body.title !== undefined) {
      if (typeof body.title !== "string" || !body.title.trim()) {
        return jsonError(400, "VALIDATION_ERROR", API_ERROR_VI.required);
      }
      data.title = body.title.trim();
    }
    if (body.isActive !== undefined) {
      data.isActive = Boolean(body.isActive);
    }
    if (body.location !== undefined || body.note !== undefined || body.status !== undefined) {
      if (body.location !== undefined) {
        data.location = body.location === null ? null : String(body.location);
      }
      if (body.note !== undefined) {
        data.note = body.note === null ? null : String(body.note);
      }
      if (body.status !== undefined && body.status !== null) {
        if (!STATUS_MAP[String(body.status)]) {
          return jsonError(400, "VALIDATION_ERROR", API_ERROR_VI.required);
        }
        data.status = STATUS_MAP[String(body.status)];
      }
      data.rule = nextRule(item.rule, {
        location: body.location === null ? null : typeof body.location === "string" ? body.location : undefined,
        note: body.note === null ? null : typeof body.note === "string" ? body.note : undefined,
        status:
          body.status === null
            ? null
            : typeof body.status === "string" && STATUS_MAP[body.status]
              ? STATUS_MAP[body.status]
              : undefined,
      });
    }

    const updated = await prisma.courseScheduleItem.update({
      where: { id },
      data,
    });

    await prisma.attendanceAudit.create({
      data: {
        scheduleItemId: id,
        actorId: authResult.auth.sub,
        action: "UPDATE_SCHEDULE",
        diff: body as Prisma.InputJsonValue,
      },
    });

    return NextResponse.json({
      item: {
        ...updated,
        meta: extractScheduleMeta(updated.rule, {
          location: updated.location,
          note: updated.note,
          status: updated.status,
          source: updated.source,
        }),
        scheduleStatus: resolveScheduleStatus(updated),
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === "INVALID_DATE") {
      return jsonError(400, "VALIDATION_ERROR", API_ERROR_VI.required);
    }
    return jsonError(500, "INTERNAL_ERROR", API_ERROR_VI.internal);
  }
}
