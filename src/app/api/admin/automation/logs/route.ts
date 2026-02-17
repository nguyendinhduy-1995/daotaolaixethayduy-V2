import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-response";
import { requireAdminRole } from "@/lib/admin-auth";
import { requireMappedRoutePermissionAuth } from "@/lib/route-auth";
import { API_ERROR_VI } from "@/lib/api-error-vi";
import { listAutomationLogs, parseDateKeyOrToday, parseLimit } from "@/lib/services/automation-monitor";

export async function GET(req: Request) {
  const auth = await requireMappedRoutePermissionAuth(req);
  if (auth.error) return auth.error;
  const adminError = requireAdminRole(auth.auth.role);
  if (adminError) return jsonError(403, "AUTH_FORBIDDEN", "Bạn không có quyền thực hiện");

  try {
    const { searchParams } = new URL(req.url);
    const dateKey = parseDateKeyOrToday(searchParams.get("date"));
    const milestone = searchParams.get("milestone") || null;
    const branchId = searchParams.get("branchId") || null;
    const runId = searchParams.get("runId") || null;
    const suggestionId = searchParams.get("suggestionId") || null;
    const outboundJobId = searchParams.get("outboundJobId") || null;
    const limit = parseLimit(searchParams.get("limit"), 100, 300);

    const items = await listAutomationLogs({
      dateKey,
      milestone,
      branchId,
      runId,
      suggestionId,
      outboundJobId,
      limit,
    });

    return NextResponse.json({ items, dateKey, total: items.length });
  } catch (error) {
    if (error instanceof Error && error.message === "INVALID_DATE") {
      return jsonError(400, "VALIDATION_ERROR", "date phải theo định dạng YYYY-MM-DD");
    }
    if (error instanceof Error && error.message === "INVALID_LIMIT") {
      return jsonError(400, "VALIDATION_ERROR", "limit không hợp lệ");
    }
    return jsonError(500, "INTERNAL_ERROR", API_ERROR_VI.internal);
  }
}
