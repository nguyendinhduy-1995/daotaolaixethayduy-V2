import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { jsonError } from "@/lib/api-response";
import { API_ERROR_VI } from "@/lib/api-error-vi";
import { isAdminRole } from "@/lib/admin-auth";
import { isLeadStatusType, logLeadEvent } from "@/lib/lead-events";
import { requirePermissionRouteAuth } from "@/lib/route-auth";
import { applyScopeToWhere, resolveScope } from "@/lib/scope";

type RouteContext = { params: Promise<{ id: string }> | { id: string } };

function validateTags(tags: unknown) {
  return (
    Array.isArray(tags) &&
    tags.every((tag) => typeof tag === "string")
  );
}

export async function GET(req: Request, context: RouteContext) {
  const authResult = await requirePermissionRouteAuth(req, { module: "leads", action: "VIEW" });
  if (authResult.error) return authResult.error;
  const auth = authResult.auth;

  try {
    const { id } = await Promise.resolve(context.params);
    const scope = await resolveScope(auth);
    const lead = await prisma.lead.findFirst({
      where: applyScopeToWhere({ id }, scope, "lead"),
      include: {
        owner: { select: { id: true, name: true, email: true, role: true, isActive: true } },
      },
    });
    if (!lead) return jsonError(404, "NOT_FOUND", API_ERROR_VI.notFoundLead);
    return NextResponse.json({ lead });
  } catch {
    return jsonError(500, "INTERNAL_ERROR", API_ERROR_VI.internal);
  }
}

export async function PATCH(req: Request, context: RouteContext) {
  const authResult = await requirePermissionRouteAuth(req, { module: "leads", action: "UPDATE" });
  if (authResult.error) return authResult.error;
  const auth = authResult.auth;

  try {
    const { id } = await Promise.resolve(context.params);
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return jsonError(400, "VALIDATION_ERROR", API_ERROR_VI.required);
    }
    if (body.status !== undefined && !isLeadStatusType(body.status)) {
      return jsonError(400, "VALIDATION_ERROR", API_ERROR_VI.required);
    }
    if (body.tags !== undefined && !validateTags(body.tags)) {
      return jsonError(400, "VALIDATION_ERROR", API_ERROR_VI.required);
    }

    const scope = await resolveScope(auth);
    const lead = await prisma.$transaction(async (tx) => {
      const current = await tx.lead.findFirst({ where: applyScopeToWhere({ id }, scope, "lead") });
      if (!current) return null;
      if (scope.mode !== "SYSTEM" && body.ownerId !== undefined) {
        throw new Error("FORBIDDEN_OWNER_CHANGE");
      }

      let nextOwnerId: string | null | undefined;
      if (body.ownerId !== undefined) {
        if (typeof body.ownerId !== "string" || !body.ownerId.trim()) {
          nextOwnerId = null;
        } else {
          const owner = await tx.user.findUnique({
            where: { id: body.ownerId },
            select: { id: true, isActive: true },
          });
          if (!owner) throw new Error("OWNER_NOT_FOUND");
          if (!owner.isActive) throw new Error("OWNER_INACTIVE");
          nextOwnerId = owner.id;
        }
      }

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
        ...(body.ownerId !== undefined ? { ownerId: nextOwnerId } : {}),
        ...(body.note !== undefined ? { note: typeof body.note === "string" ? body.note : null } : {}),
        ...(body.tags !== undefined ? { tags: body.tags } : {}),
      };

      const updated = await tx.lead.update({
        where: { id },
        data,
        include: {
          owner: { select: { id: true, name: true, email: true, role: true, isActive: true } },
        },
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

      if (isAdminRole(auth.role) && body.ownerId !== undefined && current.ownerId !== updated.ownerId) {
        await logLeadEvent(
          {
            leadId: id,
            type: "OWNER_CHANGED",
            note: "Owner changed via PATCH",
            meta: {
              fromOwnerId: current.ownerId ?? null,
              toOwnerId: updated.ownerId ?? null,
              source: "api.leads.patch",
            },
            createdById: auth.sub,
          },
          tx
        );
      }

      return updated;
    });

    if (!lead) return jsonError(404, "NOT_FOUND", API_ERROR_VI.notFoundLead);
    return NextResponse.json({ lead });
  } catch (error) {
    if (error instanceof Error && error.message === "FORBIDDEN_OWNER_CHANGE") {
      return jsonError(403, "AUTH_FORBIDDEN", API_ERROR_VI.forbidden);
    }
    if (error instanceof Error && error.message === "OWNER_NOT_FOUND") {
      return jsonError(404, "NOT_FOUND", "Không tìm thấy người phụ trách");
    }
    if (error instanceof Error && error.message === "OWNER_INACTIVE") {
      return jsonError(400, "VALIDATION_ERROR", API_ERROR_VI.required);
    }
    return jsonError(500, "INTERNAL_ERROR", API_ERROR_VI.internal);
  }
}
