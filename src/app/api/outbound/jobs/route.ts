import { jsonError } from "@/lib/api-response";
import { API_ERROR_VI } from "@/lib/api-error-vi";
import { requireIdempotencyKey, withIdempotency } from "@/lib/idempotency";
import { requireMappedRoutePermissionAuth } from "@/lib/route-auth";
import { prisma } from "@/lib/prisma";
import {
  AiCoachForbiddenError,
  AiCoachValidationError,
  createOutboundJobFromAction,
} from "@/lib/services/ai-kpi-coach";

export async function POST(req: Request) {
  const authResult = await requireMappedRoutePermissionAuth(req);
  if (authResult.error) return authResult.error;

  try {
    const idempotency = requireIdempotencyKey(req);
    if (idempotency.error) return idempotency.error;

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return jsonError(400, "VALIDATION_ERROR", API_ERROR_VI.required);
    }

    const route = new URL(req.url).pathname;
    return (
      await withIdempotency({
        key: idempotency.key!,
        route,
        actorType: "user",
        actorId: authResult.auth.sub,
        requestBody: body,
        execute: async () => {
          const data = await createOutboundJobFromAction({
            auth: authResult.auth,
            body: body as {
              channel: unknown;
              templateKey: unknown;
              leadId?: unknown;
              studentId?: unknown;
              to?: unknown;
              priority?: unknown;
              variables?: unknown;
              note?: unknown;
            },
          });
          const bodyInput = body as Record<string, unknown>;
          const suggestionId = typeof bodyInput.suggestionId === "string" ? bodyInput.suggestionId : null;
          const actionKey = typeof bodyInput.actionKey === "string" ? bodyInput.actionKey : "CREATE_CALL_LIST";
          await prisma.automationLog.create({
            data: {
              branchId: data.outboundMessage.branchId,
              leadId: data.outboundMessage.leadId,
              studentId: data.outboundMessage.studentId,
              channel: "ui",
              milestone: "ai-apply",
              status: "sent",
              payload: {
                source: "ui",
                suggestionId,
                actionKey,
                createdById: authResult.auth.sub,
                outboundMessageId: data.outboundMessage.id,
              },
            },
          });
          return { statusCode: 200, responseJson: data as Record<string, unknown> };
        },
      })
    ).response;
  } catch (error) {
    if (error instanceof AiCoachValidationError) return jsonError(400, "VALIDATION_ERROR", error.message);
    if (error instanceof AiCoachForbiddenError) return jsonError(403, "AUTH_FORBIDDEN", error.message);
    return jsonError(500, "INTERNAL_ERROR", API_ERROR_VI.internal);
  }
}
