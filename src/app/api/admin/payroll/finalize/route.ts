import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-response";
import { requireAdminRole } from "@/lib/admin-auth";
import { requireRouteAuth } from "@/lib/route-auth";
import { finalizePayrollRun } from "@/lib/services/payroll";

export async function POST(req: Request) {
  const auth = requireRouteAuth(req);
  if (auth.error) return auth.error;
  const adminError = requireAdminRole(auth.auth.role);
  if (adminError) return adminError;

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
    return jsonError(500, "INTERNAL_ERROR", "Internal server error");
  }
}
