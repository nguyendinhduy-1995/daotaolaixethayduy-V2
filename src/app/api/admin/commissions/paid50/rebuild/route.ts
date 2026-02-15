import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-response";
import { requireAdminRole } from "@/lib/admin-auth";
import { requireRouteAuth } from "@/lib/route-auth";
import { buildPaid50Commission } from "@/lib/services/commission-paid50";

export async function POST(req: Request) {
  const auth = requireRouteAuth(req);
  if (auth.error) return auth.error;
  const adminError = requireAdminRole(auth.auth.role);
  if (adminError) return adminError;

  try {
    const body = await req.json().catch(() => null);
    const month = typeof body?.month === "string" ? body.month : "";
    const branchId = typeof body?.branchId === "string" && body.branchId ? body.branchId : undefined;
    const dryRun = Boolean(body?.dryRun);

    if (!month) {
      return jsonError(400, "VALIDATION_ERROR", "month is required");
    }

    const result = await buildPaid50Commission({ month, branchId, dryRun });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "INVALID_MONTH") {
        return jsonError(400, "VALIDATION_ERROR", "Month không hợp lệ");
      }
      if (error.message === "BRANCH_NOT_FOUND") {
        return jsonError(404, "NOT_FOUND", "Không tìm thấy chi nhánh");
      }
    }
    return jsonError(500, "INTERNAL_ERROR", "Internal server error");
  }
}
