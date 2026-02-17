import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-response";
import { API_ERROR_VI } from "@/lib/api-error-vi";
import { requireMappedRoutePermissionAuth } from "@/lib/route-auth";
import {
  AiCoachForbiddenError,
  AiCoachValidationError,
  getKpiTargets,
  upsertKpiTargets,
} from "@/lib/services/ai-kpi-coach";

export async function GET(req: Request) {
  const authResult = await requireMappedRoutePermissionAuth(req);
  if (authResult.error) return authResult.error;

  try {
    const { searchParams } = new URL(req.url);
    const branchId = searchParams.get("branchId") || undefined;
    const role = searchParams.get("role") || undefined;
    const ownerId = searchParams.get("ownerId") || undefined;
    const dayOfWeekRaw = searchParams.get("dayOfWeek");
    const dayOfWeek = dayOfWeekRaw === null ? undefined : Number(dayOfWeekRaw);
    const activeOnly = searchParams.get("activeOnly") === "true";

    const data = await getKpiTargets({
      auth: authResult.auth,
      branchId,
      role,
      ownerId,
      dayOfWeek,
      activeOnly,
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
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") return jsonError(400, "VALIDATION_ERROR", API_ERROR_VI.required);

    const payload = body as Record<string, unknown>;
    const branchId = typeof payload.branchId === "string" ? payload.branchId : undefined;
    const rawItems = Array.isArray(payload.items) ? payload.items : [];

    const data = await upsertKpiTargets({
      auth: authResult.auth,
      branchId,
      items: rawItems.map((row) => {
        const item = row as Record<string, unknown>;
        return {
          branchId: typeof item.branchId === "string" ? item.branchId : undefined,
              role: String(item.role || ""),
              ownerId: typeof item.ownerId === "string" ? item.ownerId : null,
              metricKey: String(item.metricKey || ""),
          targetValue: Number(item.targetValue ?? 0),
          dayOfWeek: item.dayOfWeek === null || item.dayOfWeek === undefined ? null : Number(item.dayOfWeek),
          isActive: item.isActive === undefined ? true : Boolean(item.isActive),
        };
      }),
    });
    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof AiCoachValidationError) return jsonError(400, "VALIDATION_ERROR", error.message);
    if (error instanceof AiCoachForbiddenError) return jsonError(403, "AUTH_FORBIDDEN", error.message);
    return jsonError(500, "INTERNAL_ERROR", API_ERROR_VI.internal);
  }
}
