import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-response";
import { requireAdminRole } from "@/lib/admin-auth";
import { requireRouteAuth } from "@/lib/route-auth";
import { generatePayrollRun } from "@/lib/services/payroll";

export async function POST(req: Request) {
  const auth = requireRouteAuth(req);
  if (auth.error) return auth.error;
  const adminError = requireAdminRole(auth.auth.role);
  if (adminError) return adminError;

  try {
    const body = await req.json().catch(() => null);
    const month = typeof body?.month === "string" ? body.month : "";
    const branchId = typeof body?.branchId === "string" ? body.branchId : "";
    const dryRun = Boolean(body?.dryRun);

    if (!month || !branchId) {
      return jsonError(400, "VALIDATION_ERROR", "Thiếu month hoặc branchId");
    }

    const result = await generatePayrollRun(month, branchId, dryRun, auth.auth.sub);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "INVALID_MONTH" || error.message === "INVALID_BRANCH") {
        return jsonError(400, "VALIDATION_ERROR", "Dữ liệu không hợp lệ");
      }
      if (error.message === "BRANCH_NOT_FOUND") {
        return jsonError(404, "NOT_FOUND", "Không tìm thấy chi nhánh");
      }
      if (error.message === "PAYROLL_FINALIZED") {
        return jsonError(400, "VALIDATION_ERROR", "Bảng lương đã chốt, không thể chạy lại");
      }
    }
    return jsonError(500, "INTERNAL_ERROR", "Internal server error");
  }
}
