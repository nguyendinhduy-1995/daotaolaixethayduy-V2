import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-response";
import { ingestOpsPulse, OpsPulseValidationError } from "@/lib/services/ops-pulse";

export async function POST(req: Request) {
  try {
    const secret = process.env.OPS_SECRET?.trim();
    const headerSecret = req.headers.get("x-ops-secret")?.trim();
    if (!secret || !headerSecret || headerSecret !== secret) {
      return jsonError(403, "AUTH_FORBIDDEN", "Forbidden");
    }

    const body = await req.json().catch(() => null);
    const result = await ingestOpsPulse(body);

    return NextResponse.json({
      ok: true,
      id: result.id,
      status: result.status,
      computedJson: result.computedJson,
    });
  } catch (error) {
    if (error instanceof OpsPulseValidationError) {
      return jsonError(400, "VALIDATION_ERROR", error.message);
    }
    return jsonError(500, "INTERNAL_ERROR", "Internal server error");
  }
}
