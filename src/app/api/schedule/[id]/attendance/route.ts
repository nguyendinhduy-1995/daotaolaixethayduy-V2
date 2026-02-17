import { NextResponse } from "next/server";
import type { AttendanceStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { jsonError } from "@/lib/api-response";
import { API_ERROR_VI } from "@/lib/api-error-vi";
import { requirePermissionRouteAuth } from "@/lib/route-auth";
import { ensureAttendanceSchema } from "@/lib/attendance-db";
import { buildScheduleScopeWhere, requireScheduleRole } from "@/lib/services/schedule";

type RouteContext = { params: Promise<{ id: string }> | { id: string } };
type RowInput = { studentId: string; status: AttendanceStatus; note?: string | null };

const ATTENDANCE_STATUSES: AttendanceStatus[] = ["PRESENT", "ABSENT", "LATE"];

function isAttendanceStatus(value: unknown): value is AttendanceStatus {
  return typeof value === "string" && ATTENDANCE_STATUSES.includes(value as AttendanceStatus);
}

export async function POST(req: Request, context: RouteContext) {
  const authResult = await requirePermissionRouteAuth(req, { module: "schedule", action: "UPDATE" });
  if (authResult.error) return authResult.error;
  const roleError = requireScheduleRole(authResult.auth.role);
  if (roleError) return roleError;

  try {
    await ensureAttendanceSchema();
    const { id } = await Promise.resolve(context.params);
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object" || !Array.isArray(body.records)) {
      return jsonError(400, "VALIDATION_ERROR", API_ERROR_VI.required);
    }

    const scopeWhere = await buildScheduleScopeWhere(authResult.auth);
    const item = await prisma.courseScheduleItem.findFirst({
      where: { id, ...scopeWhere },
      select: { id: true, courseId: true },
    });
    if (!item) return jsonError(404, "NOT_FOUND", API_ERROR_VI.required);

    const recordsInput: RowInput[] = [];
    for (const row of body.records) {
      if (!row || typeof row !== "object") {
        return jsonError(400, "VALIDATION_ERROR", API_ERROR_VI.required);
      }
      if (typeof row.studentId !== "string" || !row.studentId) {
        return jsonError(400, "VALIDATION_ERROR", API_ERROR_VI.required);
      }
      if (!isAttendanceStatus(row.status)) {
        return jsonError(400, "VALIDATION_ERROR", API_ERROR_VI.required);
      }
      recordsInput.push({
        studentId: row.studentId,
        status: row.status,
        note: typeof row.note === "string" ? row.note : null,
      });
    }

    const studentIds = Array.from(new Set(recordsInput.map((r) => r.studentId)));
    const validStudents = await prisma.student.findMany({
      where: {
        id: { in: studentIds },
        courseId: item.courseId,
        ...(authResult.auth.role === "telesales" ? { lead: { ownerId: authResult.auth.sub } } : {}),
      },
      select: { id: true },
    });
    const validSet = new Set(validStudents.map((s) => s.id));
    if (validSet.size !== studentIds.length) {
      return jsonError(400, "VALIDATION_ERROR", API_ERROR_VI.required);
    }

    const previous = await prisma.attendanceRecord.findMany({
      where: { scheduleItemId: id, studentId: { in: studentIds } },
      select: { studentId: true, status: true, note: true },
    });
    const previousMap = new Map(previous.map((r) => [r.studentId, r]));

    const result = await prisma.$transaction(async (tx) => {
      const session = await tx.attendanceSession.upsert({
        where: { scheduleItemId: id },
        update: {
          note: typeof body.sessionNote === "string" ? body.sessionNote : undefined,
        },
        create: {
          scheduleItemId: id,
          note: typeof body.sessionNote === "string" ? body.sessionNote : null,
          createdById: authResult.auth.sub,
        },
      });

      for (const row of recordsInput) {
        await tx.attendanceRecord.upsert({
          where: {
            studentId_scheduleItemId: {
              studentId: row.studentId,
              scheduleItemId: id,
            },
          },
          update: {
            sessionId: session.id,
            status: row.status,
            note: row.note ?? null,
            updatedById: authResult.auth.sub,
          },
          create: {
            sessionId: session.id,
            scheduleItemId: id,
            studentId: row.studentId,
            status: row.status,
            note: row.note ?? null,
            updatedById: authResult.auth.sub,
          },
        });
      }

      const changed = recordsInput
        .map((row) => {
          const old = previousMap.get(row.studentId);
          if (!old || old.status !== row.status || (old.note || "") !== (row.note || "")) {
            return {
              studentId: row.studentId,
              from: old ? { status: old.status, note: old.note || "" } : null,
              to: { status: row.status, note: row.note || "" },
            };
          }
          return null;
        })
        .filter(Boolean);

      await tx.attendanceAudit.create({
        data: {
          scheduleItemId: id,
          actorId: authResult.auth.sub,
          action: "UPSERT_ATTENDANCE",
          diff: {
            total: recordsInput.length,
            changedCount: changed.length,
            changed,
          } as Prisma.InputJsonValue,
        },
      });

      return { sessionId: session.id, changedCount: changed.length };
    });

    return NextResponse.json({
      ok: true,
      sessionId: result.sessionId,
      updated: recordsInput.length,
      changed: result.changedCount,
    });
  } catch (err) {
    console.error("[schedule.[id].attendance]", err);
    return jsonError(500, "INTERNAL_ERROR", API_ERROR_VI.internal);
  }
}
