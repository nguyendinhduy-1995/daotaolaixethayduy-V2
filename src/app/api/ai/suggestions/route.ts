import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-response";
import { API_ERROR_VI } from "@/lib/api-error-vi";
import { requireMappedRoutePermissionAuth } from "@/lib/route-auth";
import {
  AiCoachForbiddenError,
  AiCoachValidationError,
  createAiSuggestionManual,
  listAiSuggestions,
} from "@/lib/services/ai-kpi-coach";

export async function GET(req: Request) {
  const authResult = await requireMappedRoutePermissionAuth(req);
  if (authResult.error) return authResult.error;

  try {
    const { searchParams } = new URL(req.url);
    const data = await listAiSuggestions({
      auth: authResult.auth,
      dateKey: searchParams.get("date") || searchParams.get("dateKey") || undefined,
      role: searchParams.get("role") || undefined,
      branchId: searchParams.get("branchId") || undefined,
      ownerId: searchParams.get("ownerId") || undefined,
    });
    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof AiCoachValidationError) return jsonError(400, "VALIDATION_ERROR", error.message);
    if (error instanceof AiCoachForbiddenError) return jsonError(403, "AUTH_FORBIDDEN", error.message);
    return jsonError(500, "INTERNAL_ERROR", API_ERROR_VI.internal);
  }
}

export async function POST(req: Request) {
  const authResult = await requireMappedRoutePermissionAuth(req);
  if (authResult.error) return authResult.error;

  try {
    const body = (await req.json()) as Record<string, unknown>;
    const data = await createAiSuggestionManual({
      auth: authResult.auth,
      dateKey: typeof body.dateKey === "string" ? body.dateKey : undefined,
      role: String(body.role || ""),
      branchId: typeof body.branchId === "string" ? body.branchId : undefined,
      ownerId: typeof body.ownerId === "string" ? body.ownerId : null,
      title: String(body.title || ""),
      content: String(body.content || ""),
      scoreColor: String(body.scoreColor || "YELLOW"),
      actionsJson: body.actionsJson,
      metricsJson: body.metricsJson,
    });
    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof AiCoachValidationError) return jsonError(400, "VALIDATION_ERROR", error.message);
    if (error instanceof AiCoachForbiddenError) return jsonError(403, "AUTH_FORBIDDEN", error.message);
    return jsonError(500, "INTERNAL_ERROR", API_ERROR_VI.internal);
  }
}
