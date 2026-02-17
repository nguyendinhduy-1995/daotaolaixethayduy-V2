import { NextResponse } from "next/server";
import type { AttendanceStatus, Prisma, ScheduleType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { jsonError } from "@/lib/api-response";
import { API_ERROR_VI } from "@/lib/api-error-vi";
import { requirePermissionRouteAuth } from "@/lib/route-auth";
import { isAdminRole } from "@/lib/admin-auth";
import { ensureAttendanceSchema } from "@/lib/attendance-db";
import {
  buildScheduleScopeWhere,
  dayRangeHcm,
  extractScheduleMeta,
  parseDateYmd,
  parsePositiveInt,
  requireScheduleRole,
  resolveScheduleStatus,
  type ScheduleStatusFilter,
} from "@/lib/services/schedule";
import { requireIdempotencyKey, withIdempotency } from "@/lib/idempotency";
import { resolveWriteBranchId } from "@/lib/scope";

type AttendanceCount = {
  expected: number;
  present: number;
  absent: number;
  late: number;
};

const SCHEDULE_STATUS: ScheduleStatusFilter[] = ["upcoming", "ongoing", "done", "inactive"];
const SCHEDULE_TYPES: ScheduleType[] = ["study", "exam", "reminder"];
const MANUAL_STATUSES = ["planned", "done", "cancelled", "PLANNED", "DONE", "CANCELLED"] as const;

type ManualStatus = (typeof MANUAL_STATUSES)[number];

function isScheduleStatus(value: string | null): value is ScheduleStatusFilter {
  return value !== null && SCHEDULE_STATUS.includes(value as ScheduleStatusFilter);
}

function parseIsoDate(value: unknown, field: string) {
  if (typeof value !== "string") throw new Error(`${field.toUpperCase()}_REQUIRED`);
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) throw new Error(`${field.toUpperCase()}_INVALID`);
  return d;
}

function parseOptionalIsoDate(value: unknown, field: string) {
  if (value === undefined || value === null || value === "") return null;
  return parseIsoDate(value, field);
}

function isScheduleType(value: unknown): value is ScheduleType {
  return typeof value === "string" && SCHEDULE_TYPES.includes(value as ScheduleType);
}

function isManualStatus(value: unknown): value is ManualStatus {
  return typeof value === "string" && MANUAL_STATUSES.includes(value as ManualStatus);
}

function toDbManualStatus(value: ManualStatus): "PLANNED" | "DONE" | "CANCELLED" {
  if (value === "done" || value === "DONE") return "DONE";
  if (value === "cancelled" || value === "CANCELLED") return "CANCELLED";
  return "PLANNED";
}

function dayRangeHcmByDate(date: Date) {
  const hcm = new Date(date.getTime() + 7 * 60 * 60 * 1000);
  const y = hcm.getUTCFullYear();
  const m = String(hcm.getUTCMonth() + 1).padStart(2, "0");
  const d = String(hcm.getUTCDate()).padStart(2, "0");
  return dayRangeHcm(`${y}-${m}-${d}`);
}

function effectiveEndAt(startAt: Date, endAt: Date | null) {
  return endAt ?? new Date(startAt.getTime() + 2 * 60 * 60 * 1000);
}

function hasOverlap(startA: Date, endA: Date, startB: Date, endB: Date) {
  return startA.getTime() < endB.getTime() && startB.getTime() < endA.getTime();
}

export async function GET(req: Request) {
  const authResult = await requirePermissionRouteAuth(req, { module: "schedule", action: "VIEW" });
  if (authResult.error) return authResult.error;
  const roleError = requireScheduleRole(authResult.auth.role);
  if (roleError) return roleError;

  try {
    await ensureAttendanceSchema();
    const { searchParams } = new URL(req.url);
    const page = parsePositiveInt(searchParams.get("page"), 1);
    const pageSize = parsePositiveInt(searchParams.get("pageSize"), 20);
    const from = parseDateYmd(searchParams.get("from"));
    const to = parseDateYmd(searchParams.get("to"));
    const courseId = searchParams.get("courseId");
    const status = searchParams.get("status");
    const location = searchParams.get("location")?.trim().toLowerCase();
    const q = searchParams.get("q")?.trim();

    if (status !== null && !isScheduleStatus(status)) {
      return jsonError(400, "VALIDATION_ERROR", API_ERROR_VI.required);
    }

    const startAtFilter: Prisma.DateTimeFilter = {};
    if (from) startAtFilter.gte = dayRangeHcm(from).start;
    if (to) startAtFilter.lte = dayRangeHcm(to).end;

    const scopeWhere = await buildScheduleScopeWhere(authResult.auth);
    const where: Prisma.CourseScheduleItemWhereInput = {
      ...scopeWhere,
      ...(courseId ? { courseId } : {}),
      ...(from || to ? { startAt: startAtFilter } : {}),
      ...(q
        ? {
            course: {
              students: {
                some: {
                  OR: [
                    { lead: { fullName: { contains: q, mode: "insensitive" } } },
                    { lead: { phone: { contains: q, mode: "insensitive" } } },
                  ],
                },
              },
            },
          }
        : {}),
    };

    const itemsRaw = await prisma.courseScheduleItem.findMany({
      where,
      include: {
        course: { select: { id: true, code: true, licenseType: true } },
      },
      orderBy: { startAt: "asc" },
      take: 1000,
    });

    const scheduleIds = itemsRaw.map((i) => i.id);
    const courseIds = Array.from(new Set(itemsRaw.map((i) => i.courseId)));

    const [attendanceAgg, expectedByCourseAgg] = await Promise.all([
      scheduleIds.length
        ? prisma.attendanceRecord.groupBy({
            by: ["scheduleItemId", "status"],
            where: { scheduleItemId: { in: scheduleIds } },
            _count: { _all: true },
          })
        : Promise.resolve([] as Array<{ scheduleItemId: string; status: AttendanceStatus; _count: { _all: number } }>),
      courseIds.length
        ? prisma.student.groupBy({
            by: ["courseId"],
            where: {
              courseId: { in: courseIds },
              studyStatus: { in: ["studying", "paused"] },
              ...(authResult.auth.role === "telesales" ? { lead: { ownerId: authResult.auth.sub } } : {}),
            },
            _count: { _all: true },
          })
        : Promise.resolve([] as Array<{ courseId: string | null; _count: { _all: number } }>),
    ]);

    const attendanceMap = new Map<string, AttendanceCount>();
    for (const row of attendanceAgg) {
      const base = attendanceMap.get(row.scheduleItemId) || { expected: 0, present: 0, absent: 0, late: 0 };
      if (row.status === "PRESENT") base.present = row._count._all;
      if (row.status === "ABSENT") base.absent = row._count._all;
      if (row.status === "LATE") base.late = row._count._all;
      attendanceMap.set(row.scheduleItemId, base);
    }
    const expectedMap = new Map<string, number>();
    for (const row of expectedByCourseAgg) {
      if (row.courseId) expectedMap.set(row.courseId, row._count._all);
    }

    const filtered = itemsRaw
      .map((item) => {
        const meta = extractScheduleMeta(item.rule, {
          location: item.location,
          note: item.note,
          status: item.status,
          source: item.source,
        });
        const counts = attendanceMap.get(item.id) || { expected: 0, present: 0, absent: 0, late: 0 };
        counts.expected = expectedMap.get(item.courseId) || 0;
        const scheduleStatus = resolveScheduleStatus(item);
        return {
          ...item,
          scheduleStatus,
          meta,
          attendance: counts,
        };
      })
      .filter((item) => (location ? item.meta.location.toLowerCase().includes(location) : true))
      .filter((item) => (status ? item.scheduleStatus === status : true));

    const total = filtered.length;
    const start = (page - 1) * pageSize;
    const items = filtered.slice(start, start + pageSize);

    return NextResponse.json({ items, page, pageSize, total });
  } catch (error) {
    if (error instanceof Error && (error.message === "INVALID_PAGINATION" || error.message === "INVALID_DATE")) {
      return jsonError(400, "VALIDATION_ERROR", API_ERROR_VI.required);
    }
    return jsonError(500, "INTERNAL_ERROR", API_ERROR_VI.internal);
  }
}

export async function POST(req: Request) {
  const authResult = await requirePermissionRouteAuth(req, { module: "schedule", action: "CREATE" });
  if (authResult.error) return authResult.error;
  const roleError = requireScheduleRole(authResult.auth.role);
  if (roleError) return roleError;

  try {
    await ensureAttendanceSchema();
    const idempotency = requireIdempotencyKey(req);
    if (idempotency.error) return idempotency.error;
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return jsonError(400, "VALIDATION_ERROR", API_ERROR_VI.required);
    }

    const hasCourseId = typeof body.courseId === "string" && body.courseId.trim().length > 0;
    const hasStudentId = typeof body.studentId === "string" && body.studentId.trim().length > 0;
    if (!hasCourseId && !hasStudentId) {
      return jsonError(400, "VALIDATION_ERROR", API_ERROR_VI.required);
    }
    if (!isManualStatus(body.status)) {
      return jsonError(400, "VALIDATION_ERROR", API_ERROR_VI.required);
    }
    if (body.type !== undefined && !isScheduleType(body.type)) {
      return jsonError(400, "VALIDATION_ERROR", API_ERROR_VI.required);
    }
    if (body.allowOverlap !== undefined && typeof body.allowOverlap !== "boolean") {
      return jsonError(400, "VALIDATION_ERROR", API_ERROR_VI.required);
    }

    const startAt = parseIsoDate(body.startAt, "startAt");
    const endAt = parseOptionalIsoDate(body.endAt, "endAt");
    if (endAt && endAt.getTime() <= startAt.getTime()) {
      return jsonError(400, "VALIDATION_ERROR", API_ERROR_VI.required);
    }

    const title = typeof body.title === "string" && body.title.trim() ? body.title.trim() : "Lịch học thủ công";
    const location = typeof body.location === "string" ? body.location.trim() : "";
    const note = typeof body.note === "string" ? body.note.trim() : "";

    let resolvedCourseId = hasCourseId ? String(body.courseId) : "";
    const resolvedStudentId: string | null = hasStudentId ? String(body.studentId) : null;

    if (resolvedStudentId) {
      const student = await prisma.student.findUnique({
        where: { id: resolvedStudentId },
        select: {
          id: true,
          courseId: true,
          branchId: true,
          lead: { select: { ownerId: true } },
        },
      });
      if (!student) return jsonError(404, "NOT_FOUND", API_ERROR_VI.notFoundStudent);
      if (!student.courseId) {
        return jsonError(400, "VALIDATION_ERROR", API_ERROR_VI.required);
      }
      if (!isAdminRole(authResult.auth.role) && student.lead.ownerId !== authResult.auth.sub) {
        return jsonError(403, "AUTH_FORBIDDEN", API_ERROR_VI.forbidden);
      }
      resolvedCourseId = student.courseId;
    }

    if (!resolvedCourseId) {
      return jsonError(400, "VALIDATION_ERROR", API_ERROR_VI.required);
    }

    const course = await prisma.course.findUnique({
      where: { id: resolvedCourseId },
      select: { id: true },
    });
    if (!course) return jsonError(404, "NOT_FOUND", API_ERROR_VI.required);

    if (!isAdminRole(authResult.auth.role)) {
      const ownedStudent = await prisma.student.findFirst({
        where: {
          courseId: resolvedCourseId,
          lead: { ownerId: authResult.auth.sub },
        },
        select: { id: true },
      });
      if (!ownedStudent) return jsonError(403, "AUTH_FORBIDDEN", API_ERROR_VI.forbidden);
    }

    const dayRange = dayRangeHcmByDate(startAt);
    const existingItems = await prisma.courseScheduleItem.findMany({
      where: {
        courseId: resolvedCourseId,
        isActive: true,
        startAt: {
          gte: dayRange.start,
          lte: dayRange.end,
        },
      },
      select: { id: true, startAt: true, endAt: true, title: true },
      orderBy: { startAt: "asc" },
    });

    const newEndAt = effectiveEndAt(startAt, endAt);
    const overlappedByCourse = existingItems.find((item) => {
      const itemEndAt = effectiveEndAt(item.startAt, item.endAt);
      return hasOverlap(startAt, newEndAt, item.startAt, itemEndAt);
    });

    let overlappedByStudent: { id: string; title: string } | null = null;
    if (resolvedStudentId) {
      const studentItems = await prisma.courseScheduleItem.findMany({
        where: {
          isActive: true,
          startAt: { gte: dayRange.start, lte: dayRange.end },
          course: {
            students: {
              some: { id: resolvedStudentId },
            },
          },
        },
        select: { id: true, title: true, startAt: true, endAt: true },
        orderBy: { startAt: "asc" },
      });

      const studentConflict = studentItems.find((item) => {
        const itemEndAt = effectiveEndAt(item.startAt, item.endAt);
        return hasOverlap(startAt, newEndAt, item.startAt, itemEndAt);
      });
      if (studentConflict) {
        overlappedByStudent = { id: studentConflict.id, title: studentConflict.title };
      }
    }

    const allowOverlap = isAdminRole(authResult.auth.role) && body.allowOverlap === true;
    if ((overlappedByCourse || overlappedByStudent) && !allowOverlap) {
      return jsonError(409, "SCHEDULE_CONFLICT", API_ERROR_VI.scheduleConflict);
    }

    const dbStatus = toDbManualStatus(body.status);
    const route = new URL(req.url).pathname;
    return (
      await withIdempotency({
        key: idempotency.key!,
        route,
        actorType: "user",
        actorId: authResult.auth.sub,
        requestBody: body,
        execute: async () => {
          let resolvedBranchId: string | null = null;
          if (resolvedStudentId) {
            const studentScope = await prisma.student.findUnique({
              where: { id: resolvedStudentId },
              select: { branchId: true, lead: { select: { branchId: true, owner: { select: { branchId: true } } } } },
            });
            resolvedBranchId =
              studentScope?.branchId ?? studentScope?.lead.branchId ?? studentScope?.lead.owner?.branchId ?? null;
          }
          resolvedBranchId = await resolveWriteBranchId(authResult.auth, [resolvedBranchId]);

          const item = await prisma.courseScheduleItem.create({
            data: {
              courseId: resolvedCourseId,
              branchId: resolvedBranchId,
              type: isScheduleType(body.type) ? body.type : "study",
              title,
              startAt,
              endAt,
              source: "MANUAL",
              status: dbStatus,
              location: location || null,
              note: note || null,
              isActive: dbStatus !== "CANCELLED",
              rule: {
                manual: true,
                source: "MANUAL",
                location: location || null,
                note: note || null,
                status: dbStatus,
                studentId: resolvedStudentId,
                createdById: authResult.auth.sub,
              } as Prisma.InputJsonValue,
            },
          });

          await prisma.attendanceAudit.create({
            data: {
              scheduleItemId: item.id,
              actorId: authResult.auth.sub,
              action: "CREATE_SCHEDULE",
              diff: {
                source: "manual",
                courseId: resolvedCourseId,
                branchId: resolvedBranchId,
                studentId: resolvedStudentId,
                startAt: item.startAt.toISOString(),
                endAt: item.endAt ? item.endAt.toISOString() : null,
                status: dbStatus,
                allowOverlap,
                conflictScope: {
                  byCourse: Boolean(overlappedByCourse),
                  byStudent: Boolean(overlappedByStudent),
                },
              } as Prisma.InputJsonValue,
            },
          });

          return {
            statusCode: 200,
            responseJson: {
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
            },
          };
        },
      })
    ).response;
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message.includes("STARTAT_REQUIRED") || error.message.includes("STARTAT_INVALID") || error.message.includes("ENDAT_INVALID"))
    ) {
      return jsonError(400, "VALIDATION_ERROR", API_ERROR_VI.required);
    }
    return jsonError(500, "INTERNAL_ERROR", API_ERROR_VI.internal);
  }
}
