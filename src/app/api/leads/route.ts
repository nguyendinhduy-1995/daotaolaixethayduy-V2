import { NextResponse } from "next/server";
import type { LeadStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { jsonError } from "@/lib/api-response";
import { API_ERROR_VI } from "@/lib/api-error-vi";
import { isTelesalesRole } from "@/lib/admin-auth";
import { isLeadStatusType, logLeadEvent } from "@/lib/lead-events";
import { requirePermissionRouteAuth } from "@/lib/route-auth";
import { applyScopeToWhere, resolveScope, resolveWriteBranchId } from "@/lib/scope";

type SortField = "createdAt" | "updatedAt" | "lastContactAt";
type SortOrder = "asc" | "desc";

function parsePagination(value: string | null, fallback: number, max?: number) {
  if (value === null) return fallback;
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) {
    throw new Error("INVALID_PAGINATION");
  }
  if (max) return Math.min(n, max);
  return n;
}

function parseDateYmd(value: string, endOfDay = false) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error("INVALID_DATE");
  const [y, m, d] = value.split("-").map(Number);
  const utc = new Date(Date.UTC(y, m - 1, d));
  if (utc.getUTCFullYear() !== y || utc.getUTCMonth() !== m - 1 || utc.getUTCDate() !== d) {
    throw new Error("INVALID_DATE");
  }
  return new Date(`${value}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}Z`);
}

function validateTags(tags: unknown) {
  return (
    Array.isArray(tags) &&
    tags.every((tag) => typeof tag === "string")
  );
}

export async function GET(req: Request) {
  const authResult = await requirePermissionRouteAuth(req, { module: "leads", action: "VIEW" });
  if (authResult.error) return authResult.error;
  const auth = authResult.auth;

  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const source = searchParams.get("source");
    const channel = searchParams.get("channel");
    const licenseType = searchParams.get("licenseType");
    const ownerId = searchParams.get("ownerId");
    const q = searchParams.get("q")?.trim();
    const createdFrom = searchParams.get("createdFrom");
    const createdTo = searchParams.get("createdTo");
    const page = parsePagination(searchParams.get("page"), 1);
    const pageSize = parsePagination(searchParams.get("pageSize"), 20, 100);
    const sort = (searchParams.get("sort") ?? "createdAt") as SortField;
    const order = (searchParams.get("order") ?? "desc") as SortOrder;

    if (status && !isLeadStatusType(status)) {
      return jsonError(400, "VALIDATION_ERROR", API_ERROR_VI.required);
    }
    if (!["createdAt", "updatedAt", "lastContactAt"].includes(sort)) {
      return jsonError(400, "VALIDATION_ERROR", API_ERROR_VI.required);
    }
    if (!["asc", "desc"].includes(order)) {
      return jsonError(400, "VALIDATION_ERROR", API_ERROR_VI.required);
    }

    const createdAtFilter: Prisma.DateTimeFilter = {};
    if (createdFrom) createdAtFilter.gte = parseDateYmd(createdFrom);
    if (createdTo) createdAtFilter.lte = parseDateYmd(createdTo, true);

    const scope = await resolveScope(auth);
    const whereBase: Prisma.LeadWhereInput = {
      ...(status ? { status: status as LeadStatus } : {}),
      ...(source ? { source } : {}),
      ...(channel ? { channel } : {}),
      ...(licenseType ? { licenseType } : {}),
      ...(ownerId ? { ownerId } : {}),
      ...(createdFrom || createdTo ? { createdAt: createdAtFilter } : {}),
      ...(q
        ? {
            OR: [
              { fullName: { contains: q, mode: "insensitive" } },
              { phone: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    };
    const where = applyScopeToWhere(whereBase, scope, "lead");

    const [items, total] = await Promise.all([
      prisma.lead.findMany({
        where,
        orderBy: { [sort]: order },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          owner: { select: { id: true, name: true, email: true, role: true, isActive: true } },
        },
      }),
      prisma.lead.count({ where }),
    ]);

    return NextResponse.json({
      items,
      page,
      pageSize,
      total,
    });
  } catch (error) {
    if (error instanceof Error && (error.message === "INVALID_DATE" || error.message === "INVALID_PAGINATION")) {
      return jsonError(400, "VALIDATION_ERROR", API_ERROR_VI.required);
    }
    return jsonError(500, "INTERNAL_ERROR", API_ERROR_VI.internal);
  }
}

export async function POST(req: Request) {
  const authResult = await requirePermissionRouteAuth(req, { module: "leads", action: "CREATE" });
  if (authResult.error) return authResult.error;
  const auth = authResult.auth;

  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return jsonError(400, "VALIDATION_ERROR", API_ERROR_VI.required);
    }
    if (body.tags !== undefined && !validateTags(body.tags)) {
      return jsonError(400, "VALIDATION_ERROR", API_ERROR_VI.required);
    }

    const requestedBranchId =
      typeof body.branchId === "string" && body.branchId.trim().length > 0 ? body.branchId.trim() : null;
    const branchId = await resolveWriteBranchId(auth, [requestedBranchId]);
    const phone = typeof body.phone === "string" ? body.phone.trim() : "";
    const lead = await prisma.$transaction(async (tx) => {
      const created = await tx.lead.create({
        data: {
          fullName: typeof body.fullName === "string" ? body.fullName : null,
          phone: phone || null,
          province: typeof body.province === "string" ? body.province : null,
          licenseType: typeof body.licenseType === "string" ? body.licenseType : null,
          source: typeof body.source === "string" ? body.source : "manual",
          channel: typeof body.channel === "string" ? body.channel : "manual",
          status: phone ? "HAS_PHONE" : "NEW",
          note: typeof body.note === "string" ? body.note : null,
          tags: body.tags ?? [],
          branchId,
          ...(isTelesalesRole(auth.role) ? { ownerId: auth.sub } : {}),
        },
      });

      if (created.status === "HAS_PHONE") {
        await logLeadEvent(
          {
            leadId: created.id,
            type: "HAS_PHONE",
            note: "Auto status from lead creation with phone",
            meta: { source: "api.leads.create" },
            createdById: auth.sub,
          },
          tx
        );
      }

      return created;
    });

    return NextResponse.json({ lead });
  } catch {
    return jsonError(500, "INTERNAL_ERROR", API_ERROR_VI.internal);
  }
}
