import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError } from "@/lib/api-response";
import { requireRouteAuth } from "@/lib/route-auth";
import { KpiDateError, resolveKpiDateParam } from "@/lib/services/kpi-daily";

function dayRangeInHoChiMinh(dateStr: string) {
  const start = new Date(`${dateStr}T00:00:00.000+07:00`);
  const end = new Date(`${dateStr}T23:59:59.999+07:00`);
  return { start, end };
}

export async function GET(req: Request) {
  const authResult = requireRouteAuth(req);
  if (authResult.error) return authResult.error;

  try {
    const { searchParams } = new URL(req.url);
    const date = resolveKpiDateParam(searchParams.get("date"));
    const { start, end } = dayRangeInHoChiMinh(date);

    const agg = await prisma.receipt.aggregate({
      where: { receivedAt: { gte: start, lte: end } },
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
    return jsonError(500, "INTERNAL_ERROR", "Internal server error");
  }
}
