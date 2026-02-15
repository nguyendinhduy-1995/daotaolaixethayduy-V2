import { NextResponse } from "next/server";
import type { AutomationStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { jsonError } from "@/lib/api-response";
import { requireRouteAuth } from "@/lib/route-auth";
import { isAdminRole, isTelesalesRole } from "@/lib/admin-auth";
import { KpiDateError, resolveKpiDateParam } from "@/lib/services/kpi-daily";

type RuntimeStatus = "queued" | "running" | "success" | "failed";
type DeliveryStatus = "sent" | "skipped" | "failed";

function parsePositiveInt(value: string | null, fallback: number, max = 100) {
  if (value === null) return fallback;
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) throw new Error("INVALID_PAGINATION");
  return Math.min(n, max);
}

function dayRangeInHoChiMinh(dateStr: string) {
  const start = new Date(`${dateStr}T00:00:00.000+07:00`);
  const end = new Date(`${dateStr}T23:59:59.999+07:00`);
  return { start, end };
}

function isRuntimeStatus(value: string | null): value is RuntimeStatus {
  return value === "queued" || value === "running" || value === "success" || value === "failed";
}

function isDeliveryStatus(value: string | null): value is DeliveryStatus {
  return value === "sent" || value === "skipped" || value === "failed";
}

function toDeliveryStatus(value: DeliveryStatus): AutomationStatus {
  if (value === "sent") return "sent";
  if (value === "skipped") return "skipped";
  return "failed";
}

export async function GET(req: Request) {
  const authResult = requireRouteAuth(req);
  if (authResult.error) return authResult.error;

  try {
    const { searchParams } = new URL(req.url);
    const scope = searchParams.get("scope");
    const status = searchParams.get("status");
    const leadId = searchParams.get("leadId");
    const studentId = searchParams.get("studentId");
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const page = parsePositiveInt(searchParams.get("page"), 1);
    const pageSize = parsePositiveInt(searchParams.get("pageSize"), 20);

    if (!isAdminRole(authResult.auth.role) && !isTelesalesRole(authResult.auth.role)) {
      return jsonError(403, "AUTH_FORBIDDEN", "Forbidden");
    }

    if (status !== null && !isRuntimeStatus(status) && !isDeliveryStatus(status)) {
      return jsonError(400, "VALIDATION_ERROR", "Invalid status filter");
    }

    const sentAtFilter: Prisma.DateTimeFilter = {};
    if (from) sentAtFilter.gte = dayRangeInHoChiMinh(resolveKpiDateParam(from)).start;
    if (to) sentAtFilter.lte = dayRangeInHoChiMinh(resolveKpiDateParam(to)).end;

    let where: Prisma.AutomationLogWhereInput = {
      ...(scope ? { milestone: scope } : {}),
      ...(leadId ? { leadId } : {}),
      ...(studentId ? { studentId } : {}),
      ...(from || to ? { sentAt: sentAtFilter } : {}),
      ...(isTelesalesRole(authResult.auth.role)
        ? {
            OR: [
              { lead: { ownerId: authResult.auth.sub } },
              { student: { lead: { ownerId: authResult.auth.sub } } },
            ],
          }
        : {}),
    };

    if (status) {
      if (status === "sent" || status === "skipped") {
        where = { ...where, status: toDeliveryStatus(status) };
      } else if (status === "queued" || status === "running") {
        where = {
          ...where,
          payload: {
            path: ["runtimeStatus"],
            equals: status,
          },
        };
      } else if (status === "failed") {
        where = {
          AND: [
            where,
            {
              OR: [
                { status: "failed" },
                {
                  payload: {
                    path: ["runtimeStatus"],
                    equals: "failed",
                  },
                },
              ],
            },
          ],
        };
      } else if (status === "success") {
        where = {
          AND: [
            where,
            {
              OR: [
                { status: { in: ["sent", "skipped"] } },
                {
                  payload: {
                    path: ["runtimeStatus"],
                    equals: "success",
                  },
                },
              ],
            },
          ],
        };
      }
    }

    const [items, total] = await Promise.all([
      prisma.automationLog.findMany({
        where,
        orderBy: { sentAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.automationLog.count({ where }),
    ]);

    return NextResponse.json({ items, page, pageSize, total });
  } catch (error) {
    if (error instanceof KpiDateError) {
      return jsonError(400, "VALIDATION_ERROR", error.message);
    }
    if (error instanceof Error && error.message === "INVALID_PAGINATION") {
      return jsonError(400, "VALIDATION_ERROR", "Invalid pagination");
    }
    return jsonError(500, "INTERNAL_ERROR", "Internal server error");
  }
}
