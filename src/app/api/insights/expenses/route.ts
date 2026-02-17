import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-response";
import { API_ERROR_VI } from "@/lib/api-error-vi";
import { requireMappedRoutePermissionAuth } from "@/lib/route-auth";
import { ExpenseForbiddenError, ExpenseValidationError, listExpenseInsights } from "@/lib/services/expenses";

export async function GET(req: Request) {
  const authResult = await requireMappedRoutePermissionAuth(req);
  if (authResult.error) return authResult.error;
  try {
    const { searchParams } = new URL(req.url);
    const monthKey = searchParams.get("month") || undefined;
    const dateKey = searchParams.get("date") || undefined;
    const branchId = searchParams.get("branchId") || undefined;

    const items = await listExpenseInsights({
      auth: authResult.auth,
      monthKey,
      dateKey,
      branchId,
    });
    return NextResponse.json({ items });
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

