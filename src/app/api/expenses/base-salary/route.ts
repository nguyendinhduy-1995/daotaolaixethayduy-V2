import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-response";
import { API_ERROR_VI } from "@/lib/api-error-vi";
import { requireMappedRoutePermissionAuth } from "@/lib/route-auth";
import {
  ExpenseForbiddenError,
  ExpenseValidationError,
  getBaseSalaryRows,
  upsertBaseSalaryRows,
} from "@/lib/services/expenses";

export async function GET(req: Request) {
  const authResult = await requireMappedRoutePermissionAuth(req);
  if (authResult.error) return authResult.error;
  try {
    const { searchParams } = new URL(req.url);
    const monthKey = searchParams.get("month");
    if (!monthKey) return jsonError(400, "VALIDATION_ERROR", API_ERROR_VI.required);
    const branchId = searchParams.get("branchId") || undefined;

    const data = await getBaseSalaryRows({
      auth: authResult.auth,
      monthKey,
      branchId,
    });
    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof ExpenseValidationError) {
      return jsonError(400, "VALIDATION_ERROR", error.message);
    }
    if (error instanceof ExpenseForbiddenError) {
      return jsonError(403, "AUTH_FORBIDDEN", error.message);
    }
    return jsonError(500, "INTERNAL_ERROR", API_ERROR_VI.internal);
  }
}

export async function POST(req: Request) {
  const authResult = await requireMappedRoutePermissionAuth(req);
  if (authResult.error) return authResult.error;
  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return jsonError(400, "VALIDATION_ERROR", API_ERROR_VI.required);
    }
    const payload = body as Record<string, unknown>;
    const monthKey = String(payload.monthKey || payload.month || "");
    const branchId = typeof payload.branchId === "string" ? payload.branchId : undefined;
    const itemsRaw = Array.isArray(payload.items) ? payload.items : [];
    const items = itemsRaw.map((row) => {
      const item = row as Record<string, unknown>;
      return {
        userId: String(item.userId || ""),
        baseSalaryVnd: Number(item.baseSalaryVnd || 0),
        note: typeof item.note === "string" ? item.note : undefined,
      };
    });

    const data = await upsertBaseSalaryRows({
      auth: authResult.auth,
      monthKey,
      branchId,
      items,
    });
    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof ExpenseValidationError) {
      return jsonError(400, "VALIDATION_ERROR", error.message);
    }
    if (error instanceof ExpenseForbiddenError) {
      return jsonError(403, "AUTH_FORBIDDEN", error.message);
    }
    return jsonError(500, "INTERNAL_ERROR", API_ERROR_VI.internal);
  }
}

