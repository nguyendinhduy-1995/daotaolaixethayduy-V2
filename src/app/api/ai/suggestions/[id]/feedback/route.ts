import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-response";
import { API_ERROR_VI } from "@/lib/api-error-vi";
import { requireMappedRoutePermissionAuth } from "@/lib/route-auth";
import { hasPermission } from "@/lib/permissions";
import { AiCoachForbiddenError, AiCoachValidationError, addAiSuggestionFeedback } from "@/lib/services/ai-kpi-coach";

export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  const authResult = await requireMappedRoutePermissionAuth(req);
  if (authResult.error) return authResult.error;
  if (
    !hasPermission({
      user: authResult.auth,
      module: "ai_suggestions",
      action: "VIEW",
      permissions: authResult.permissions,
    })
  ) {
    return jsonError(403, "AUTH_FORBIDDEN", API_ERROR_VI.forbidden);
  }

  try {
    const params = await context.params;
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") return jsonError(400, "VALIDATION_ERROR", API_ERROR_VI.required);
    const payload = body as Record<string, unknown>;

    const data = await addAiSuggestionFeedback({
      auth: authResult.auth,
      suggestionId: params.id,
      feedbackType: typeof payload.feedbackType === "string" ? payload.feedbackType : "",
      reason: typeof payload.reason === "string" ? payload.reason : "",
      reasonDetail: typeof payload.reasonDetail === "string" ? payload.reasonDetail : undefined,
      actualResult:
        payload.actualResult && typeof payload.actualResult === "object"
          ? (payload.actualResult as { data?: number; hen?: number; den?: number; ky?: number })
          : undefined,
      note: typeof payload.note === "string" ? payload.note : undefined,
    });
    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof AiCoachValidationError) return jsonError(400, "VALIDATION_ERROR", error.message);
    if (error instanceof AiCoachForbiddenError) return jsonError(403, "AUTH_FORBIDDEN", error.message);
    return jsonError(500, "INTERNAL_ERROR", API_ERROR_VI.internal);
  }
}
