import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-response";
import { requireMappedRoutePermissionAuth } from "@/lib/route-auth";
import { getKpiDaily, KpiDateError, resolveKpiDateParam } from "@/lib/services/kpi-daily";

export async function GET(req: Request) {
  const authResult = await requireMappedRoutePermissionAuth(req);
  if (authResult.error) return authResult.error;

  try {
    const { searchParams } = new URL(req.url);
    const date = resolveKpiDateParam(searchParams.get("date"));
    const kpi = await getKpiDaily(date, authResult.auth);
    return NextResponse.json(kpi);
  } catch (error) {
    if (error instanceof KpiDateError) {
      return jsonError(400, "BAD_REQUEST", error.message);
    }
    return jsonError(500, "INTERNAL_ERROR", "Lỗi hệ thống");
  }
}
