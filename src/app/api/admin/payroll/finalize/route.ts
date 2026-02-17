import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-response";
import { requirePermissionRouteAuth } from "@/lib/route-auth";
import { finalizePayrollRun } from "@/lib/services/payroll";
import { API_ERROR_VI } from "@/lib/api-error-vi";

export async function POST(req: Request) {
  const auth = await requirePermissionRouteAuth(req, { module: "hr_total_payroll", action: "RUN" });
  if (auth.error) return auth.error;

  try {
    const body = await req.json().catch(() => null);
    const month = typeof body?.month === "string" ? body.month : "";
    const branchId = typeof body?.branchId === "string" ? body.branchId : "";

    if (!month || !branchId) {
      return jsonError(400, "VALIDATION_ERROR", "Thiếu month hoặc branchId");
    }

    const run = await finalizePayrollRun(month, branchId);
    return NextResponse.json({ run });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "INVALID_MONTH") {
        return jsonError(400, "VALIDATION_ERROR", "Month không hợp lệ");
      }
      if (error.message === "PAYROLL_NOT_FOUND") {
        return jsonError(404, "NOT_FOUND", "Chưa có bảng lương để chốt");
      }
    }
    return jsonError(500, "INTERNAL_ERROR", API_ERROR_VI.internal);
  }
}
