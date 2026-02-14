import { NextResponse } from "next/server";
import type { AttendanceStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { jsonError } from "@/lib/api-response";
import { requireRouteAuth } from "@/lib/route-auth";
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

type AttendanceCount = {
  expected: number;
  present: number;
  absent: number;
  late: number;
};

const SCHEDULE_STATUS: ScheduleStatusFilter[] = ["upcoming", "ongoing", "done", "inactive"];

function isScheduleStatus(value: string | null): value is ScheduleStatusFilter {
  return value !== null && SCHEDULE_STATUS.includes(value as ScheduleStatusFilter);
}

export async function GET(req: Request) {
  const authResult = requireRouteAuth(req);
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
      return jsonError(400, "VALIDATION_ERROR", "Invalid status");
    }

    const startAtFilter: Prisma.DateTimeFilter = {};
    if (from) startAtFilter.gte = dayRangeHcm(from).start;
    if (to) startAtFilter.lte = dayRangeHcm(to).end;

    const where: Prisma.CourseScheduleItemWhereInput = {
      ...buildScheduleScopeWhere(authResult.auth),
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
        const meta = extractScheduleMeta(item.rule);
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
      return jsonError(400, "VALIDATION_ERROR", "Invalid query");
    }
    return jsonError(500, "INTERNAL_ERROR", "Internal server error");
  }
}
