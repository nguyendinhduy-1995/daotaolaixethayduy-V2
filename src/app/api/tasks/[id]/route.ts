import { NextResponse } from "next/server";
import type { NotificationStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { jsonError } from "@/lib/api-response";
import { API_ERROR_VI } from "@/lib/api-error-vi";
import { requireMappedRoutePermissionAuth } from "@/lib/route-auth";
import { isAdminRole } from "@/lib/admin-auth";

function mapApiStatusToDb(statusRaw: string): NotificationStatus {
  const value = statusRaw.trim().toUpperCase();
  if (value === "NEW") return "NEW";
  if (value === "IN_PROGRESS" || value === "DOING") return "DOING";
  if (value === "DONE") return "DONE";
  if (value === "CANCELED" || value === "SKIPPED") return "SKIPPED";
  throw new Error("INVALID_STATUS");
}

function mapDbStatusToApi(status: NotificationStatus) {
  if (status === "NEW") return "NEW";
  if (status === "DOING") return "IN_PROGRESS";
  if (status === "DONE") return "DONE";
  return "CANCELED";
}

function getPayloadObject(payload: Prisma.JsonValue | null): Record<string, unknown> {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return {};
  return payload as Record<string, unknown>;
}

function isTaskPayload(payload: Prisma.JsonValue | null) {
  const body = getPayloadObject(payload);
  return body.kind === "TASK";
}

export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  const authResult = await requireMappedRoutePermissionAuth(req);
  if (authResult.error) return authResult.error;

  try {
    const params = await context.params;
    const body = (await req.json()) as Record<string, unknown>;
    const nextStatus = mapApiStatusToDb(String(body.status || ""));

    const current = await prisma.notification.findUnique({
      where: { id: params.id },
      include: {
        lead: { select: { ownerId: true } },
        student: { select: { lead: { select: { ownerId: true } } } },
      },
    });
    if (!current || !isTaskPayload(current.payload)) {
      return jsonError(404, "NOT_FOUND", "Không tìm thấy việc cần làm");
    }

    if (!isAdminRole(authResult.auth.role)) {
      const ownsTask =
        current.ownerId === authResult.auth.sub ||
        current.lead?.ownerId === authResult.auth.sub ||
        current.student?.lead?.ownerId === authResult.auth.sub;
      if (!ownsTask) {
        return jsonError(403, "AUTH_FORBIDDEN", API_ERROR_VI.forbidden);
      }
    }

    const updated = await prisma.notification.update({
      where: { id: current.id },
      data: { status: nextStatus },
    });

    const payloadObj = getPayloadObject(updated.payload);
    const suggestionId = typeof payloadObj.suggestionId === "string" ? payloadObj.suggestionId : null;

    if (updated.status === "DONE") {
      let branchId: string | null = null;
      if (updated.leadId) {
        const lead = await prisma.lead.findUnique({ where: { id: updated.leadId }, select: { branchId: true } });
        branchId = lead?.branchId || null;
      } else if (updated.studentId) {
        const student = await prisma.student.findUnique({ where: { id: updated.studentId }, select: { branchId: true } });
        branchId = student?.branchId || null;
      } else if (updated.ownerId) {
        const owner = await prisma.user.findUnique({ where: { id: updated.ownerId }, select: { branchId: true } });
        branchId = owner?.branchId || null;
      }

      if (branchId) {
        await prisma.automationLog.create({
          data: {
            branchId,
            leadId: updated.leadId,
            studentId: updated.studentId,
            channel: "ui",
            milestone: "task-status",
            status: "sent",
            payload: {
              kind: "TASK",
              source: "ui",
              taskId: updated.id,
              fromStatus: current.status,
              toStatus: updated.status,
              suggestionId,
              changedById: authResult.auth.sub,
            },
          },
        });
      }
    }

    return NextResponse.json({
      task: { ...updated, status: mapDbStatusToApi(updated.status), rawStatus: updated.status },
      suggestionId,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "INVALID_STATUS") {
      return jsonError(400, "VALIDATION_ERROR", "Trạng thái việc không hợp lệ");
    }
    return jsonError(500, "INTERNAL_ERROR", API_ERROR_VI.internal);
  }
}

