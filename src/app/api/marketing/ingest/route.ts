import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-response";
import { upsertMarketingMetric, validateMarketingInput } from "@/lib/services/marketing-metrics";

export async function POST(req: Request) {
  try {
    const secret = process.env.MARKETING_SECRET?.trim();
    const headerSecret = req.headers.get("x-marketing-secret")?.trim();
    if (!secret || !headerSecret || headerSecret !== secret) {
      return jsonError(403, "AUTH_FORBIDDEN", "Forbidden");
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") return jsonError(400, "VALIDATION_ERROR", "Invalid JSON body");

    const validated = validateMarketingInput(body as Record<string, unknown>);
    if (!validated.ok) return jsonError(400, "VALIDATION_ERROR", validated.error);

    const metric = await upsertMarketingMetric(validated.data);
    return NextResponse.json({ ok: true, metric });
  } catch {
    return jsonError(500, "INTERNAL_ERROR", "Internal server error");
  }
}
