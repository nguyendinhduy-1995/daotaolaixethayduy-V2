import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError } from "@/lib/api-response";
import { API_ERROR_VI } from "@/lib/api-error-vi";
import { requirePermissionRouteAuth } from "@/lib/route-auth";
import { logLeadEvent } from "@/lib/lead-events";

export async function POST(req: Request) {
  const authResult = await requirePermissionRouteAuth(req, { module: "leads", action: "ASSIGN" });
  if (authResult.error) return authResult.error;

  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return jsonError(400, "VALIDATION_ERROR", API_ERROR_VI.required);
    }
    if (
      !Array.isArray(body.leadIds) ||
      body.leadIds.length === 0 ||
      !body.leadIds.every((id: unknown) => typeof id === "string")
    ) {
      return jsonError(400, "VALIDATION_ERROR", API_ERROR_VI.required);
    }
    if (!body.ownerId || typeof body.ownerId !== "string") {
      return jsonError(400, "VALIDATION_ERROR", API_ERROR_VI.required);
    }

    const owner = await prisma.user.findUnique({
      where: { id: body.ownerId },
      select: { id: true, isActive: true },
    });
    if (!owner) return jsonError(404, "NOT_FOUND", API_ERROR_VI.required);
    if (!owner.isActive) return jsonError(400, "VALIDATION_ERROR", API_ERROR_VI.required);

    const leadIds = body.leadIds as string[];
    const uniqueLeadIds = Array.from(new Set(leadIds));

    const result = await prisma.$transaction(async (tx) => {
      const leads = await tx.lead.findMany({
        where: { id: { in: uniqueLeadIds } },
        select: { id: true, ownerId: true },
      });

      let updated = 0;
      for (const lead of leads) {
        if (lead.ownerId === owner.id) continue;
        await tx.lead.update({
          where: { id: lead.id },
          data: { ownerId: owner.id },
        });
        await logLeadEvent(
          {
            leadId: lead.id,
            type: "OWNER_CHANGED",
            note: "Owner changed via bulk assign",
            meta: {
              fromOwnerId: lead.ownerId ?? null,
              toOwnerId: owner.id,
              source: "api.leads.assign",
            },
            createdById: authResult.auth.sub,
          },
          tx
        );
        updated += 1;
      }

      return { updated };
    });

    return NextResponse.json(result);
  } catch (err) {
    console.error("[leads.assign]", err);
    return jsonError(500, "INTERNAL_ERROR", API_ERROR_VI.internal);
  }
}
