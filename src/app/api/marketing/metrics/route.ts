import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-response";
import { requireMappedRoutePermissionAuth } from "@/lib/route-auth";
import { listReports } from "@/lib/services/marketing";

export async function GET(req: Request) {
  const authResult = await requireMappedRoutePermissionAuth(req);
  if (authResult.error) return authResult.error;

  try {
    const { searchParams } = new URL(req.url);
    const grainRaw = (searchParams.get("grain") || "DAY").toUpperCase();
    const from = searchParams.get("from") || undefined;
    const to = searchParams.get("to") || undefined;
    const source = (searchParams.get("source") || "meta_ads").trim().toLowerCase();

    if (grainRaw !== "DAY") {
      return jsonError(400, "VALIDATION_ERROR", "Deprecated metrics endpoint only supports DAY grain");
    }
    if (source !== "meta_ads" && source !== "meta") {
      return jsonError(400, "VALIDATION_ERROR", "source must be meta_ads");
    }
    if ((from && !/^\d{4}-\d{2}-\d{2}$/.test(from)) || (to && !/^\d{4}-\d{2}-\d{2}$/.test(to))) {
      return jsonError(400, "VALIDATION_ERROR", "Invalid from/to for selected grain");
    }

    const payload = await listReports({
      from,
      to,
      source: source === "meta_ads" ? "meta" : source,
    });

    return NextResponse.json({
      items: payload.items.map((item) => ({
        id: item.id,
        source: "meta_ads",
        grain: "DAY",
        dateKey: item.dateKey,
        spendVnd: item.spendVnd,
        messages: item.messages,
        cplVnd: item.cplVnd,
        meta: item.metaJson,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      })),
      totals: payload.totals,
      warning: "Endpoint deprecated. Use GET /api/admin/marketing/reports",
    });
  } catch (err) {
    console.error("[marketing.metrics]", err);
    return jsonError(500, "INTERNAL_ERROR", "Internal server error");
  }
}
