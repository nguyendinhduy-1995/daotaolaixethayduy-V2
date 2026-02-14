import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError } from "@/lib/api-response";
import { requireRouteAuth } from "@/lib/route-auth";
import { requireAdminRole } from "@/lib/admin-auth";
import { logLeadEvent } from "@/lib/lead-events";

export async function POST(req: Request) {
  const authResult = requireRouteAuth(req);
  if (authResult.error) return authResult.error;
  const adminError = requireAdminRole(authResult.auth.role);
  if (adminError) return adminError;

  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return jsonError(400, "VALIDATION_ERROR", "Invalid JSON body");
    }
    if (
      !Array.isArray(body.leadIds) ||
      body.leadIds.length === 0 ||
      !body.leadIds.every((id: unknown) => typeof id === "string")
    ) {
      return jsonError(400, "VALIDATION_ERROR", "leadIds must be a non-empty array of strings");
    }
    if (!body.ownerId || typeof body.ownerId !== "string") {
      return jsonError(400, "VALIDATION_ERROR", "ownerId is required");
    }

    const owner = await prisma.user.findUnique({
      where: { id: body.ownerId },
      select: { id: true, isActive: true },
    });
    if (!owner) return jsonError(404, "NOT_FOUND", "Owner not found");
    if (!owner.isActive) return jsonError(400, "VALIDATION_ERROR", "Owner is inactive");

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
  } catch {
    return jsonError(500, "INTERNAL_ERROR", "Internal server error");
  }
}
