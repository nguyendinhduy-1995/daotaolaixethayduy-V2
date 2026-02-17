import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError } from "@/lib/api-response";
import { API_ERROR_VI } from "@/lib/api-error-vi";
import { isLeadEventType, isStatusTransitionEventType, logLeadEvent } from "@/lib/lead-events";
import { requirePermissionRouteAuth } from "@/lib/route-auth";
import { applyScopeToWhere, resolveScope } from "@/lib/scope";

type RouteContext = { params: Promise<{ id: string }> | { id: string } };

export async function POST(req: Request, context: RouteContext) {
  const authResult = await requirePermissionRouteAuth(req, { module: "leads", action: "UPDATE" });
  if (authResult.error) return authResult.error;
  const auth = authResult.auth;

  try {
    const { id } = await Promise.resolve(context.params);
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object" || !isLeadEventType(body.type)) {
      return jsonError(400, "VALIDATION_ERROR", API_ERROR_VI.required);
    }
    if (body.note !== undefined && typeof body.note !== "string") {
      return jsonError(400, "VALIDATION_ERROR", API_ERROR_VI.required);
    }

    const scope = await resolveScope(auth);
    const result = await prisma.$transaction(async (tx) => {
      const lead = await tx.lead.findFirst({
        where: applyScopeToWhere({ id }, scope, "lead"),
        select: { id: true, status: true, ownerId: true },
      });
      if (!lead) return null;

      const event = await logLeadEvent(
        {
          leadId: id,
          type: body.type,
          note: body.note,
          meta: body.meta,
          createdById: auth.sub,
        },
        tx
      );

      if (isStatusTransitionEventType(body.type) && lead.status !== body.type) {
        await tx.lead.update({
          where: { id },
          data: { status: body.type },
        });
      }

      return { event };
    });

    if (!result) return jsonError(404, "NOT_FOUND", API_ERROR_VI.notFoundLead);
    return NextResponse.json(result);
  } catch (err) {
    console.error("[leads.[id].events]", err);
    return jsonError(500, "INTERNAL_ERROR", API_ERROR_VI.internal);
  }
}

export async function GET(req: Request, context: RouteContext) {
  const authResult = await requirePermissionRouteAuth(req, { module: "leads", action: "VIEW" });
  if (authResult.error) return authResult.error;
  const auth = authResult.auth;

  try {
    const { id } = await Promise.resolve(context.params);
    const { searchParams } = new URL(req.url);
    const page = Number(searchParams.get("page") || "1");
    const pageSize = Number(searchParams.get("pageSize") || "20");
    const sort = searchParams.get("sort") || "createdAt";
    const order = searchParams.get("order") || "desc";

    if (!Number.isInteger(page) || page <= 0 || !Number.isInteger(pageSize) || pageSize <= 0 || pageSize > 100) {
      return jsonError(400, "VALIDATION_ERROR", API_ERROR_VI.required);
    }
    if (sort !== "createdAt") {
      return jsonError(400, "VALIDATION_ERROR", API_ERROR_VI.required);
    }
    if (order !== "asc" && order !== "desc") {
      return jsonError(400, "VALIDATION_ERROR", API_ERROR_VI.required);
    }

    const scope = await resolveScope(auth);
    const lead = await prisma.lead.findFirst({
      where: applyScopeToWhere({ id }, scope, "lead"),
      select: { id: true, ownerId: true },
    });
    if (!lead) return jsonError(404, "NOT_FOUND", API_ERROR_VI.notFoundLead);

    const [items, total] = await Promise.all([
      prisma.leadEvent.findMany({
        where: { leadId: id },
        orderBy: { createdAt: order },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.leadEvent.count({ where: { leadId: id } }),
    ]);

    return NextResponse.json({ items, page, pageSize, total });
  } catch (err) {
    console.error("[leads.[id].events]", err);
    return jsonError(500, "INTERNAL_ERROR", API_ERROR_VI.internal);
  }
}
