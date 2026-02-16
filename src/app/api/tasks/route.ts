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
const STATUSES: NotificationStatus[] = ["NEW", "DOING", "DONE", "SKIPPED"];
const PRIORITIES: NotificationPriority[] = ["HIGH", "MEDIUM", "LOW"];

function parsePositiveInt(value: string | null, fallback: number, max = 100) {
  if (value === null) return fallback;
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) throw new Error("INVALID_PAGINATION");
  return Math.min(n, max);
}

function isScope(value: string | null): value is NotificationScope {
  return value !== null && SCOPES.includes(value as NotificationScope);
}

function isStatus(value: string | null): value is NotificationStatus {
  return value !== null && STATUSES.includes(value as NotificationStatus);
}

function parsePriority(value: unknown) {
  const priority = String(value || "MEDIUM").toUpperCase();
  if (!PRIORITIES.includes(priority as NotificationPriority)) {
    throw new Error("INVALID_PRIORITY");
  }
  return priority as NotificationPriority;
}

function dayRangeInHoChiMinh(dateStr: string) {
  const start = new Date(`${dateStr}T00:00:00.000+07:00`);
  const end = new Date(`${dateStr}T23:59:59.999+07:00`);
  return { start, end };
}

export async function GET(req: Request) {
  const authResult = await requireMappedRoutePermissionAuth(req);
  if (authResult.error) return authResult.error;

  try {
    await ensureNotificationSchema();
    const { searchParams } = new URL(req.url);
    const scope = searchParams.get("scope");
    const status = searchParams.get("status");
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const q = searchParams.get("q")?.trim();
    const page = parsePositiveInt(searchParams.get("page"), 1);
    const pageSize = parsePositiveInt(searchParams.get("pageSize"), 20);

    if (scope !== null && !isScope(scope)) return jsonError(400, "VALIDATION_ERROR", API_ERROR_VI.required);
    if (status !== null && !isStatus(status)) return jsonError(400, "VALIDATION_ERROR", API_ERROR_VI.required);

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

    const where: Prisma.NotificationWhereInput = {
      ...(scope ? { scope } : {}),
      ...(status ? { status } : {}),
      ...(from || to ? { dueAt } : {}),
      ...(andClauses.length > 0 ? { AND: andClauses } : {}),
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

    return NextResponse.json({ items, page, pageSize, total });
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
    const dueAt = typeof body.dueAt === "string" && body.dueAt.trim() ? new Date(body.dueAt) : null;
    if (dueAt && Number.isNaN(dueAt.getTime())) {
      return jsonError(400, "VALIDATION_ERROR", "dueAt không hợp lệ");
    }

    const notification = await prisma.notification.create({
      data: {
        scope: scope as NotificationScope,
        status: "NEW",
        priority,
        title,
        message,
        payload: (body.payload as Prisma.InputJsonValue) ?? null,
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

    return NextResponse.json({ task: notification });
  } catch (error) {
    if (error instanceof Error && error.message === "INVALID_PRIORITY") {
      return jsonError(400, "VALIDATION_ERROR", API_ERROR_VI.required);
    }
    return jsonError(500, "INTERNAL_ERROR", API_ERROR_VI.internal);
  }
}
