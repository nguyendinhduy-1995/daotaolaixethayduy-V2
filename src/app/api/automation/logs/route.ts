import { NextResponse } from "next/server";
import type { AutomationStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { jsonError } from "@/lib/api-response";
import { requirePermissionRouteAuth } from "@/lib/route-auth";
import { isAdminRole, isTelesalesRole } from "@/lib/admin-auth";
import { KpiDateError, resolveKpiDateParam } from "@/lib/services/kpi-daily";
import { API_ERROR_VI } from "@/lib/api-error-vi";
import { resolveScope } from "@/lib/scope";

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
  const authResult = await requirePermissionRouteAuth(req, { module: "automation_logs", action: "VIEW" });
  if (authResult.error) return authResult.error;

  try {
    const { searchParams } = new URL(req.url);
    const accessScope = await resolveScope(authResult.auth);
    const scope = searchParams.get("scope");
    const status = searchParams.get("status");
    const leadId = searchParams.get("leadId");
    const studentId = searchParams.get("studentId");
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const page = parsePositiveInt(searchParams.get("page"), 1);
    const pageSize = parsePositiveInt(searchParams.get("pageSize"), 20);

    if (!isAdminRole(authResult.auth.role) && !isTelesalesRole(authResult.auth.role)) {
      return jsonError(403, "AUTH_FORBIDDEN", API_ERROR_VI.forbidden);
    }

    if (status !== null && !isRuntimeStatus(status) && !isDeliveryStatus(status)) {
      return jsonError(400, "VALIDATION_ERROR", API_ERROR_VI.required);
    }

    const sentAtFilter: Prisma.DateTimeFilter = {};
    if (from) sentAtFilter.gte = dayRangeInHoChiMinh(resolveKpiDateParam(from)).start;
    if (to) sentAtFilter.lte = dayRangeInHoChiMinh(resolveKpiDateParam(to)).end;

    const andScope: Prisma.AutomationLogWhereInput[] = [];
    if (accessScope.mode === "BRANCH" && accessScope.branchId) {
      andScope.push({ branchId: accessScope.branchId });
    }
    if (accessScope.mode === "OWNER" && accessScope.ownerId) {
      andScope.push({
        OR: [{ lead: { ownerId: accessScope.ownerId } }, { student: { lead: { ownerId: accessScope.ownerId } } }],
      });
      if (accessScope.branchId) andScope.push({ branchId: accessScope.branchId });
    }

    let where: Prisma.AutomationLogWhereInput = {
      ...(scope ? { milestone: scope } : {}),
      ...(leadId ? { leadId } : {}),
      ...(studentId ? { studentId } : {}),
      ...(from || to ? { sentAt: sentAtFilter } : {}),
      ...(andScope.length > 0 ? { AND: andScope } : {}),
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
      return jsonError(400, "VALIDATION_ERROR", API_ERROR_VI.required);
    }
    return jsonError(500, "INTERNAL_ERROR", API_ERROR_VI.internal);
  }
}

export async function POST(req: Request) {
  const authResult = await requirePermissionRouteAuth(req, { module: "automation_logs", action: "CREATE" });
  if (authResult.error) return authResult.error;

  try {
    const body = (await req.json()) as Record<string, unknown>;
    const channel = String(body.channel || "").trim();
    const milestone = String(body.milestone || "").trim();
    const statusRaw = String(body.status || "").trim().toLowerCase();
    const status: AutomationStatus =
      statusRaw === "failed" ? "failed" : statusRaw === "skipped" ? "skipped" : "sent";
    if (!channel) return jsonError(400, "VALIDATION_ERROR", API_ERROR_VI.required);

    const scope = await resolveScope(authResult.auth);
    let branchId: string | null = null;
    if (typeof body.branchId === "string" && body.branchId.trim()) {
      branchId = body.branchId.trim();
    } else if (scope.branchId) {
      branchId = scope.branchId;
    }
    if (!branchId) {
      return jsonError(400, "VALIDATION_ERROR", "Thiếu branchId");
    }

    const created = await prisma.automationLog.create({
      data: {
        leadId: typeof body.leadId === "string" ? body.leadId : null,
        studentId: typeof body.studentId === "string" ? body.studentId : null,
        branchId,
        channel,
        templateKey: typeof body.templateKey === "string" ? body.templateKey : null,
        milestone: milestone || null,
        status,
        sentAt: new Date(),
        payload: (body.payload as Prisma.InputJsonValue) ?? null,
      },
    });
    return NextResponse.json({ log: created });
  } catch {
    return jsonError(500, "INTERNAL_ERROR", API_ERROR_VI.internal);
  }
}
