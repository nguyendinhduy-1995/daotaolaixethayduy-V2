import { GoalPeriodType } from "@prisma/client";
import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-response";
import { API_ERROR_VI } from "@/lib/api-error-vi";
import { requireMappedRoutePermissionAuth } from "@/lib/route-auth";
import {
  AiCoachForbiddenError,
  AiCoachValidationError,
  getGoals,
  upsertGoal,
} from "@/lib/services/ai-kpi-coach";

function parsePeriodType(value: unknown): GoalPeriodType {
  const raw = String(value || "").toUpperCase();
  if (raw !== "DAILY" && raw !== "MONTHLY") throw new AiCoachValidationError("periodType không hợp lệ");
  return raw;
}

export async function GET(req: Request) {
  const authResult = await requireMappedRoutePermissionAuth(req);
  if (authResult.error) return authResult.error;

  try {
    const { searchParams } = new URL(req.url);
    const periodType = parsePeriodType(searchParams.get("periodType"));
    const branchId = searchParams.get("branchId") || undefined;
    const dateKey = searchParams.get("dateKey") || undefined;
    const monthKey = searchParams.get("monthKey") || undefined;

    const data = await getGoals({
      auth: authResult.auth,
      periodType,
      branchId,
      dateKey,
      monthKey,
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
    const data = await upsertGoal({
      auth: authResult.auth,
      periodType: parsePeriodType(payload.periodType),
      branchId: typeof payload.branchId === "string" ? payload.branchId : null,
      dateKey: typeof payload.dateKey === "string" ? payload.dateKey : undefined,
      monthKey: typeof payload.monthKey === "string" ? payload.monthKey : undefined,
      revenueTarget: Number(payload.revenueTarget ?? 0),
      dossierTarget: Number(payload.dossierTarget ?? 0),
      costTarget: Number(payload.costTarget ?? 0),
      note: typeof payload.note === "string" ? payload.note : undefined,
    });

    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof AiCoachValidationError) return jsonError(400, "VALIDATION_ERROR", error.message);
    if (error instanceof AiCoachForbiddenError) return jsonError(403, "AUTH_FORBIDDEN", error.message);
    return jsonError(500, "INTERNAL_ERROR", API_ERROR_VI.internal);
  }
}
