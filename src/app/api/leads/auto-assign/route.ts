import { NextResponse } from "next/server";
import type { LeadStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { jsonError } from "@/lib/api-response";
import { API_ERROR_VI } from "@/lib/api-error-vi";
import { requirePermissionRouteAuth } from "@/lib/route-auth";
import { isLeadStatusType, logLeadEvent } from "@/lib/lead-events";

function parseDateYmd(value: string, endOfDay = false) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error("INVALID_DATE");
  const [y, m, d] = value.split("-").map(Number);
  const utc = new Date(Date.UTC(y, m - 1, d));
  if (utc.getUTCFullYear() !== y || utc.getUTCMonth() !== m - 1 || utc.getUTCDate() !== d) {
    throw new Error("INVALID_DATE");
  }
  return new Date(`${value}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}Z`);
}

function buildLeadWhere(filters: Record<string, unknown>) {
  const status = typeof filters.status === "string" ? filters.status : undefined;
  const source = typeof filters.source === "string" ? filters.source : undefined;
  const channel = typeof filters.channel === "string" ? filters.channel : undefined;
  const licenseType = typeof filters.licenseType === "string" ? filters.licenseType : undefined;
  const ownerId = typeof filters.ownerId === "string" ? filters.ownerId : undefined;
  const q = typeof filters.q === "string" ? filters.q.trim() : "";
  const createdFrom = typeof filters.createdFrom === "string" ? filters.createdFrom : undefined;
  const createdTo = typeof filters.createdTo === "string" ? filters.createdTo : undefined;

  if (status && !isLeadStatusType(status)) throw new Error("INVALID_STATUS");

  const createdAtFilter: Prisma.DateTimeFilter = {};
  if (createdFrom) createdAtFilter.gte = parseDateYmd(createdFrom);
  if (createdTo) createdAtFilter.lte = parseDateYmd(createdTo, true);

  return {
    ...(status ? { status: status as LeadStatus } : {}),
    ...(source ? { source } : {}),
    ...(channel ? { channel } : {}),
    ...(licenseType ? { licenseType } : {}),
    ...(ownerId ? { ownerId } : {}),
    ...(createdFrom || createdTo ? { createdAt: createdAtFilter } : {}),
    ...(q
      ? {
          OR: [
            { fullName: { contains: q, mode: "insensitive" as const } },
            { phone: { contains: q, mode: "insensitive" as const } },
          ],
        }
      : {}),
  } satisfies Prisma.LeadWhereInput;
}

export async function POST(req: Request) {
  const authResult = await requirePermissionRouteAuth(req, { module: "leads", action: "ASSIGN" });
  if (authResult.error) return authResult.error;

  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return jsonError(400, "VALIDATION_ERROR", API_ERROR_VI.required);
    }
    if (body.strategy !== "round_robin") {
      return jsonError(400, "VALIDATION_ERROR", API_ERROR_VI.required);
    }
    if (body.leadIds !== undefined && (!Array.isArray(body.leadIds) || !body.leadIds.every((id: unknown) => typeof id === "string"))) {
      return jsonError(400, "VALIDATION_ERROR", API_ERROR_VI.required);
    }
    if (body.filters !== undefined && (body.filters === null || typeof body.filters !== "object")) {
      return jsonError(400, "VALIDATION_ERROR", API_ERROR_VI.required);
    }

    const telesales = await prisma.user.findMany({
      where: { role: "telesales", isActive: true },
      select: { id: true },
      orderBy: { createdAt: "asc" },
    });
    if (telesales.length === 0) {
      return jsonError(404, "NOT_FOUND", API_ERROR_VI.required);
    }

    let leads: Array<{ id: string; ownerId: string | null }> = [];
    if (Array.isArray(body.leadIds) && body.leadIds.length > 0) {
      const leadIds = body.leadIds as string[];
      const uniqueLeadIds = Array.from(new Set(leadIds));
      leads = await prisma.lead.findMany({
        where: { id: { in: uniqueLeadIds } },
        select: { id: true, ownerId: true },
        orderBy: { createdAt: "asc" },
      });
    } else {
      const where = buildLeadWhere((body.filters as Record<string, unknown>) || {});
      leads = await prisma.lead.findMany({
        where,
        select: { id: true, ownerId: true },
        orderBy: { createdAt: "asc" },
      });
    }

    if (leads.length === 0) {
      return NextResponse.json({ updated: 0, assigned: [] });
    }

    const prioritized = [
      ...leads.filter((lead) => !lead.ownerId),
      ...leads.filter((lead) => lead.ownerId),
    ];

    const result = await prisma.$transaction(async (tx) => {
      const assigned: Array<{ leadId: string; ownerId: string }> = [];
      let updated = 0;
      let idx = 0;

      for (const lead of prioritized) {
        const nextOwnerId = telesales[idx % telesales.length].id;
        idx += 1;
        if (lead.ownerId === nextOwnerId) continue;

        await tx.lead.update({
          where: { id: lead.id },
          data: { ownerId: nextOwnerId },
        });
        await logLeadEvent(
          {
            leadId: lead.id,
            type: "OWNER_CHANGED",
            note: "Owner changed via auto assign",
            meta: {
              fromOwnerId: lead.ownerId ?? null,
              toOwnerId: nextOwnerId,
              source: "api.leads.auto-assign",
            },
            createdById: authResult.auth.sub,
          },
          tx
        );
        assigned.push({ leadId: lead.id, ownerId: nextOwnerId });
        updated += 1;
      }

      return { updated, assigned };
    });

    return NextResponse.json(result);
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message === "INVALID_DATE" || error.message === "INVALID_STATUS")
    ) {
      return jsonError(400, "VALIDATION_ERROR", API_ERROR_VI.required);
    }
    return jsonError(500, "INTERNAL_ERROR", API_ERROR_VI.internal);
  }
}
