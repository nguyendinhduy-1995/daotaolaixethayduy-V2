import { NextResponse } from "next/server";
import type { MarketingGrain } from "@prisma/client";
import { jsonError } from "@/lib/api-response";
import { requireRouteAuth } from "@/lib/route-auth";
import { MARKETING_SOURCE, getMarketingMetrics, validateRangeByGrain } from "@/lib/services/marketing-metrics";

export async function GET(req: Request) {
  const authResult = requireRouteAuth(req);
  if (authResult.error) return authResult.error;

  try {
    const { searchParams } = new URL(req.url);
    const grainRaw = (searchParams.get("grain") || "DAY").toUpperCase();
    const from = searchParams.get("from") || undefined;
    const to = searchParams.get("to") || undefined;
    const source = (searchParams.get("source") || MARKETING_SOURCE).trim().toLowerCase();

    if (grainRaw !== "DAY" && grainRaw !== "MONTH" && grainRaw !== "YEAR") {
      return jsonError(400, "VALIDATION_ERROR", "grain must be DAY | MONTH | YEAR");
    }
    const grain: MarketingGrain = grainRaw;
    if (source !== MARKETING_SOURCE) {
      return jsonError(400, "VALIDATION_ERROR", "source must be meta_ads");
    }
    if (!validateRangeByGrain(grain, from) || !validateRangeByGrain(grain, to)) {
      return jsonError(400, "VALIDATION_ERROR", "Invalid from/to for selected grain");
    }

    const payload = await getMarketingMetrics({
      grain,
      from,
      to,
      source,
    });

    return NextResponse.json(payload);
  } catch {
    return jsonError(500, "INTERNAL_ERROR", "Internal server error");
  }
}
