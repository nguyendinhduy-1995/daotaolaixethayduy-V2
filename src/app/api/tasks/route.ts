import { NextResponse } from "next/server";
import type { NotificationPriority, NotificationScope, NotificationStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { jsonError } from "@/lib/api-response";
import { API_ERROR_VI } from "@/lib/api-error-vi";
import { requireMappedRoutePermissionAuth } from "@/lib/route-auth";
import { isAdminRole } from "@/lib/admin-auth";
import { ensureNotificationSchema } from "@/lib/notifications-db";
import { KpiDateError, resolveKpiDateParam } from "@/lib/services/kpi-daily";

const SCOPES: NotificationScope[] = ["FINANCE", "FOLLOWUP", "SCHEDULE", "SYSTEM"];
const PRIORITIES: NotificationPriority[] = ["HIGH", "MEDIUM", "LOW"];
const TASK_TYPES = ["TASK", "REMINDER", "CALL_LIST"] as const;
type TaskType = (typeof TASK_TYPES)[number];

function parsePositiveInt(value: string | null, fallback: number, max = 100) {
  if (value === null) return fallback;
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) throw new Error("INVALID_PAGINATION");
  return Math.min(n, max);
}

function isScope(value: string | null): value is NotificationScope {
  return value !== null && SCOPES.includes(value as NotificationScope);
}

function mapApiStatusToDb(value: string | null): NotificationStatus | null {
  if (value === null) return null;
  const status = value.trim().toUpperCase();
  if (status === "NEW") return "NEW";
  if (status === "IN_PROGRESS" || status === "DOING") return "DOING";
  if (status === "DONE") return "DONE";
  if (status === "CANCELED" || status === "SKIPPED") return "SKIPPED";
  return null;
}

function mapDbStatusToApi(status: NotificationStatus) {
  if (status === "NEW") return "NEW";
  if (status === "DOING") return "IN_PROGRESS";
  if (status === "DONE") return "DONE";
  return "CANCELED";
}

function parsePriority(value: unknown) {
  const priority = String(value || "MEDIUM").toUpperCase();
  if (!PRIORITIES.includes(priority as NotificationPriority)) {
    throw new Error("INVALID_PRIORITY");
  }
  return priority as NotificationPriority;
}

function parseTaskType(value: unknown): TaskType {
  const taskType = String(value || "TASK").toUpperCase();
  if (!TASK_TYPES.includes(taskType as TaskType)) throw new Error("INVALID_TASK_TYPE");
  return taskType as TaskType;
}

function dayRangeInHoChiMinh(dateStr: string) {
  const start = new Date(`${dateStr}T00:00:00.000+07:00`);
  const end = new Date(`${dateStr}T23:59:59.999+07:00`);
  return { start, end };
}

function mapTaskOutput<T extends { status: NotificationStatus }>(item: T) {
  return {
    ...item,
    rawStatus: item.status,
    status: mapDbStatusToApi(item.status),
  };
}

export async function GET(req: Request) {
  const authResult = await requireMappedRoutePermissionAuth(req);
  if (authResult.error) return authResult.error;

  try {
    await ensureNotificationSchema();
    const { searchParams } = new URL(req.url);
    const scope = searchParams.get("scope");
    const status = mapApiStatusToDb(searchParams.get("status"));
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const q = searchParams.get("q")?.trim();
    const suggestionId = searchParams.get("suggestionId")?.trim();
    const page = parsePositiveInt(searchParams.get("page"), 1);
    const pageSize = parsePositiveInt(searchParams.get("pageSize"), 20);

    if (scope !== null && !isScope(scope)) return jsonError(400, "VALIDATION_ERROR", API_ERROR_VI.required);
    if (searchParams.get("status") !== null && !status) return jsonError(400, "VALIDATION_ERROR", "Trạng thái việc không hợp lệ");

    const dueAt: Prisma.DateTimeFilter = {};
    if (from) dueAt.gte = dayRangeInHoChiMinh(resolveKpiDateParam(from)).start;
    if (to) dueAt.lte = dayRangeInHoChiMinh(resolveKpiDateParam(to)).end;

    const andClauses: Prisma.NotificationWhereInput[] = [];
    if (q) {
      andClauses.push({
        OR: [{ title: { contains: q, mode: "insensitive" } }, { message: { contains: q, mode: "insensitive" } }],
      });
    }
    if (!isAdminRole(authResult.auth.role)) {
      andClauses.push({
        OR: [
          { ownerId: authResult.auth.sub },
          { lead: { ownerId: authResult.auth.sub } },
          { student: { lead: { ownerId: authResult.auth.sub } } },
        ],
      });
    }

    const whereAnd: Prisma.NotificationWhereInput[] = [
      ...andClauses,
      {
        payload: {
          path: ["kind"],
          equals: "TASK",
        },
      },
    ];
    if (suggestionId) {
      whereAnd.push({
        payload: {
          path: ["suggestionId"],
          equals: suggestionId,
        },
      });
    }

    const where: Prisma.NotificationWhereInput = {
      ...(scope ? { scope } : {}),
      ...(status ? { status } : {}),
      ...(from || to ? { dueAt } : {}),
      ...(whereAnd.length > 0 ? { AND: whereAnd } : {}),
    };

    const [items, total] = await Promise.all([
      prisma.notification.findMany({
        where,
        include: {
          lead: { select: { id: true, fullName: true, phone: true, ownerId: true } },
          student: { include: { lead: { select: { id: true, fullName: true, phone: true, ownerId: true } } } },
          owner: { select: { id: true, name: true, email: true } },
        },
        orderBy: [{ status: "asc" }, { dueAt: "asc" }, { createdAt: "desc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.notification.count({ where }),
    ]);

    return NextResponse.json({ items: items.map(mapTaskOutput), page, pageSize, total });
  } catch (error) {
    if (error instanceof KpiDateError) return jsonError(400, "VALIDATION_ERROR", error.message);
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
    await ensureNotificationSchema();
    const body = (await req.json()) as Record<string, unknown>;
    const title = String(body.title || "").trim();
    const message = String(body.message || "").trim();
    if (!title || !message) return jsonError(400, "VALIDATION_ERROR", API_ERROR_VI.required);

    const scope = String(body.scope || "FOLLOWUP").toUpperCase();
    if (!SCOPES.includes(scope as NotificationScope)) return jsonError(400, "VALIDATION_ERROR", API_ERROR_VI.required);
    const priority = parsePriority(body.priority);

    const ownerIdFromBody = typeof body.ownerId === "string" ? body.ownerId : null;
    const ownerId = isAdminRole(authResult.auth.role) ? ownerIdFromBody : authResult.auth.sub;
    const taskType = parseTaskType(body.type);
    const suggestionId = typeof body.suggestionId === "string" ? body.suggestionId.trim() : "";
    const actionKey = typeof body.actionKey === "string" ? body.actionKey.trim() : "";
    const dueAt = typeof body.dueAt === "string" && body.dueAt.trim() ? new Date(body.dueAt) : null;
    if (dueAt && Number.isNaN(dueAt.getTime())) {
      return jsonError(400, "VALIDATION_ERROR", "dueAt không hợp lệ");
    }

    const payloadInput = body.payload && typeof body.payload === "object" ? (body.payload as Record<string, unknown>) : {};
    const payload: Prisma.InputJsonValue = {
      ...payloadInput,
      kind: "TASK",
      taskType,
      suggestionId: suggestionId || null,
      actionKey: actionKey || null,
      createdById: authResult.auth.sub,
      fromAssistant: true,
    };

    const notification = await prisma.notification.create({
      data: {
        scope: scope as NotificationScope,
        status: "NEW",
        priority,
        title,
        message,
        payload,
        leadId: typeof body.leadId === "string" ? body.leadId : null,
        studentId: typeof body.studentId === "string" ? body.studentId : null,
        courseId: typeof body.courseId === "string" ? body.courseId : null,
        ownerId,
        dueAt,
      },
      include: {
        owner: { select: { id: true, name: true, email: true } },
      },
    });

    let logBranchId: string | null = null;
    if (notification.leadId) {
      const lead = await prisma.lead.findUnique({ where: { id: notification.leadId }, select: { branchId: true } });
      logBranchId = lead?.branchId || null;
    } else if (notification.studentId) {
      const student = await prisma.student.findUnique({ where: { id: notification.studentId }, select: { branchId: true } });
      logBranchId = student?.branchId || null;
    } else if (notification.ownerId) {
      const owner = await prisma.user.findUnique({ where: { id: notification.ownerId }, select: { branchId: true } });
      logBranchId = owner?.branchId || null;
    }

    if (logBranchId) {
      await prisma.automationLog.create({
        data: {
          branchId: logBranchId,
          leadId: notification.leadId,
          studentId: notification.studentId,
          channel: "ui",
          milestone: "ai-apply",
          status: "sent",
          payload,
        },
      });
    }

    return NextResponse.json({ task: mapTaskOutput(notification) });
  } catch (error) {
    if (error instanceof Error && error.message === "INVALID_PRIORITY") {
      return jsonError(400, "VALIDATION_ERROR", API_ERROR_VI.required);
    }
    if (error instanceof Error && error.message === "INVALID_TASK_TYPE") {
      return jsonError(400, "VALIDATION_ERROR", "Loại việc không hợp lệ");
    }
    return jsonError(500, "INTERNAL_ERROR", API_ERROR_VI.internal);
  }
}
