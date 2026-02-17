import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-response";
import { upsertDailyReport, validateReportInput } from "@/lib/services/marketing";

export async function POST(req: Request) {
  try {
    const secret = process.env.MARKETING_SECRET?.trim();
    const headerSecret = req.headers.get("x-marketing-secret")?.trim();
    if (!secret || !headerSecret || headerSecret !== secret) {
      return jsonError(403, "AUTH_FORBIDDEN", "Forbidden");
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") return jsonError(400, "VALIDATION_ERROR", "Invalid JSON body");

    const raw = body as Record<string, unknown>;
    const grain = typeof raw.grain === "string" ? raw.grain.trim().toUpperCase() : "DAY";
    if (grain !== "DAY") {
      return jsonError(400, "VALIDATION_ERROR", "Deprecated ingest endpoint only supports DAY grain");
    }

    const sourceRaw = typeof raw.source === "string" ? raw.source.trim().toLowerCase() : "meta_ads";
    if (sourceRaw !== "meta_ads" && sourceRaw !== "meta") {
      return jsonError(400, "VALIDATION_ERROR", "source must be meta_ads");
    }

    const adapted = {
      date: typeof raw.date === "string" ? raw.date : raw.dateKey,
      source: sourceRaw === "meta_ads" ? "meta" : sourceRaw,
      spendVnd: raw.spendVnd,
      messages: raw.messages,
      branchId: raw.branchId,
      branchCode: raw.branchCode,
      meta: raw.meta,
    };
    const validated = validateReportInput(adapted);
    if (!validated.ok) return jsonError(400, "VALIDATION_ERROR", validated.error);

    const item = await upsertDailyReport(validated.data);
    return NextResponse.json({
      ok: true,
      metric: {
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
      },
      warning: "Endpoint deprecated. Use POST /api/marketing/report",
    });
  } catch (err) {
    console.error("[marketing.ingest]", err);
    return jsonError(500, "INTERNAL_ERROR", "Internal server error");
  }
}
