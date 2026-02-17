import { NextResponse } from "next/server";
import type { NotificationStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { jsonError } from "@/lib/api-response";
import { requireMappedRoutePermissionAuth } from "@/lib/route-auth";
import { isAdminRole } from "@/lib/admin-auth";
import { ensureNotificationSchema } from "@/lib/notifications-db";
import { KpiDateError, resolveKpiDateParam } from "@/lib/services/kpi-daily";

type RouteContext = { params: Promise<{ id: string }> | { id: string } };

const STATUSES: NotificationStatus[] = ["NEW", "DOING", "DONE", "SKIPPED"];

function isStatus(value: unknown): value is NotificationStatus {
  return typeof value === "string" && STATUSES.includes(value as NotificationStatus);
}

function parseDueAt(value: unknown) {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  if (typeof value !== "string") throw new Error("INVALID_DUE_AT");
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const date = resolveKpiDateParam(value);
    return new Date(`${date}T00:00:00.000+07:00`);
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) throw new Error("INVALID_DUE_AT");
  return parsed;
}

export async function PATCH(req: Request, context: RouteContext) {
  const authResult = await requireMappedRoutePermissionAuth(req);
  if (authResult.error) return authResult.error;

  try {
    await ensureNotificationSchema();
    const { id } = await Promise.resolve(context.params);
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return jsonError(400, "VALIDATION_ERROR", "Invalid JSON body");
    }
    if (body.status !== undefined && !isStatus(body.status)) {
      return jsonError(400, "VALIDATION_ERROR", "Invalid status");
    }

    const notification = await prisma.notification.findUnique({
      where: { id },
      include: {
        lead: { select: { ownerId: true } },
        student: { include: { lead: { select: { ownerId: true } } } },
      },
    });
    if (!notification) return jsonError(404, "NOT_FOUND", "Notification not found");

    if (!isAdminRole(authResult.auth.role)) {
      const inScope =
        notification.ownerId === authResult.auth.sub ||
        notification.lead?.ownerId === authResult.auth.sub ||
        notification.student?.lead.ownerId === authResult.auth.sub;
      if (!inScope) return jsonError(403, "AUTH_FORBIDDEN", "Forbidden");
    }

    const updated = await prisma.notification.update({
      where: { id },
      data: {
        ...(body.status !== undefined ? { status: body.status } : {}),
        ...(body.dueAt !== undefined ? { dueAt: parseDueAt(body.dueAt) } : {}),
      },
    });

    return NextResponse.json({ notification: updated });
  } catch (error) {
    if (error instanceof KpiDateError) {
      return jsonError(400, "VALIDATION_ERROR", error.message);
    }
    if (error instanceof Error && error.message === "INVALID_DUE_AT") {
      return jsonError(400, "VALIDATION_ERROR", "Invalid dueAt");
    }
    return jsonError(500, "INTERNAL_ERROR", "Internal server error");
  }
}
