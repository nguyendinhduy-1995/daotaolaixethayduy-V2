import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError } from "@/lib/api-response";
import { API_ERROR_VI } from "@/lib/api-error-vi";
import { requireMappedRoutePermissionAuth } from "@/lib/route-auth";
import { applyScopeToWhere, resolveScope } from "@/lib/scope";
import { KpiDateError, resolveKpiDateParam } from "@/lib/services/kpi-daily";

function dayRangeInHoChiMinh(dateStr: string) {
  const start = new Date(`${dateStr}T00:00:00.000+07:00`);
  const end = new Date(`${dateStr}T23:59:59.999+07:00`);
  return { start, end };
}

export async function GET(req: Request) {
  const authResult = await requireMappedRoutePermissionAuth(req);
  if (authResult.error) return authResult.error;

  try {
    const scope = await resolveScope(authResult.auth);
    const { searchParams } = new URL(req.url);
    const date = resolveKpiDateParam(searchParams.get("date"));
    const { start, end } = dayRangeInHoChiMinh(date);

    const where = applyScopeToWhere(
      {
        receivedAt: { gte: start, lte: end },
      },
      scope,
      "receipt"
    );

    const agg = await prisma.receipt.aggregate({
      where,
      _sum: { amount: true },
      _count: { id: true },
    });

    return NextResponse.json({
      date,
      totalThu: agg._sum.amount ?? 0,
      totalPhieuThu: agg._count.id ?? 0,
    });
  } catch (error) {
    if (error instanceof KpiDateError) {
      return jsonError(400, "VALIDATION_ERROR", error.message);
    }
    return jsonError(500, "INTERNAL_ERROR", API_ERROR_VI.internal);
  }
}
