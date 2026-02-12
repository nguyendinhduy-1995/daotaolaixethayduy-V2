import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { AuthError, requireAuth } from "@/lib/auth";
import { jsonError } from "@/lib/api-response";
import { isLeadStatusType, logLeadEvent } from "@/lib/lead-events";

type RouteContext = { params: Promise<{ id: string }> | { id: string } };

function assertAuth(req: Request) {
  try {
    return requireAuth(req);
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: jsonError(error.status, error.code, error.message) };
    }
    return { error: jsonError(401, "AUTH_MISSING_BEARER", "Missing or invalid Authorization Bearer token") };
  }
}

function validateTags(tags: unknown) {
  return (
    Array.isArray(tags) &&
    tags.every((tag) => typeof tag === "string")
  );
}

export async function GET(req: Request, context: RouteContext) {
  const auth = assertAuth(req);
  if ("error" in auth) return auth.error;

  try {
    const { id } = await Promise.resolve(context.params);
    const lead = await prisma.lead.findUnique({ where: { id } });
    if (!lead) return jsonError(404, "NOT_FOUND", "Lead not found");
    return NextResponse.json({ lead });
  } catch {
    return jsonError(500, "INTERNAL_ERROR", "Internal server error");
  }
}

export async function PATCH(req: Request, context: RouteContext) {
  const auth = assertAuth(req);
  if ("error" in auth) return auth.error;

  try {
    const { id } = await Promise.resolve(context.params);
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return jsonError(400, "VALIDATION_ERROR", "Invalid JSON body");
    }
    if (body.status !== undefined && !isLeadStatusType(body.status)) {
      return jsonError(400, "VALIDATION_ERROR", "Invalid status");
    }
    if (body.tags !== undefined && !validateTags(body.tags)) {
      return jsonError(400, "VALIDATION_ERROR", "tags must be an array of strings");
    }

    const lead = await prisma.$transaction(async (tx) => {
      const current = await tx.lead.findUnique({ where: { id } });
      if (!current) return null;

      const data: Prisma.LeadUpdateInput = {
        ...(body.fullName !== undefined ? { fullName: typeof body.fullName === "string" ? body.fullName : null } : {}),
        ...(body.phone !== undefined
          ? { phone: typeof body.phone === "string" && body.phone.trim() ? body.phone.trim() : null }
          : {}),
        ...(body.province !== undefined ? { province: typeof body.province === "string" ? body.province : null } : {}),
        ...(body.licenseType !== undefined
          ? { licenseType: typeof body.licenseType === "string" ? body.licenseType : null }
          : {}),
        ...(body.source !== undefined ? { source: typeof body.source === "string" ? body.source : null } : {}),
        ...(body.channel !== undefined ? { channel: typeof body.channel === "string" ? body.channel : null } : {}),
        ...(body.status !== undefined ? { status: body.status } : {}),
        ...(body.ownerId !== undefined ? { ownerId: typeof body.ownerId === "string" ? body.ownerId : null } : {}),
        ...(body.note !== undefined ? { note: typeof body.note === "string" ? body.note : null } : {}),
        ...(body.tags !== undefined ? { tags: body.tags } : {}),
      };

      const updated = await tx.lead.update({
        where: { id },
        data,
      });

      if (body.status !== undefined && body.status !== current.status) {
        await logLeadEvent(
          {
            leadId: id,
            type: body.status,
            note: "Status changed via PATCH",
            meta: { from: current.status, to: body.status, source: "api.leads.patch" },
            createdById: auth.sub,
          },
          tx
        );
      }

      return updated;
    });

    if (!lead) return jsonError(404, "NOT_FOUND", "Lead not found");
    return NextResponse.json({ lead });
  } catch {
    return jsonError(500, "INTERNAL_ERROR", "Internal server error");
  }
}
