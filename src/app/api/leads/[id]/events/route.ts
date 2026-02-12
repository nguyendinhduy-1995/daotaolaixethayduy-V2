import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { AuthError, requireAuth } from "@/lib/auth";
import { jsonError } from "@/lib/api-response";
import { isLeadEventType, isStatusTransitionEventType, logLeadEvent } from "@/lib/lead-events";

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

export async function POST(req: Request, context: RouteContext) {
  const auth = assertAuth(req);
  if ("error" in auth) return auth.error;

  try {
    const { id } = await Promise.resolve(context.params);
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object" || !isLeadEventType(body.type)) {
      return jsonError(400, "VALIDATION_ERROR", "Invalid event body");
    }
    if (body.note !== undefined && typeof body.note !== "string") {
      return jsonError(400, "VALIDATION_ERROR", "note must be a string");
    }

    const result = await prisma.$transaction(async (tx) => {
      const lead = await tx.lead.findUnique({
        where: { id },
        select: { id: true, status: true },
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

    if (!result) return jsonError(404, "NOT_FOUND", "Lead not found");
    return NextResponse.json(result);
  } catch {
    return jsonError(500, "INTERNAL_ERROR", "Internal server error");
  }
}
