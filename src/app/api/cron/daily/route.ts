import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-response";
import { runDailyCron } from "@/lib/services/cron-daily";

export async function POST(req: Request) {
  try {
    const secret = process.env.CRON_SECRET?.trim();
    const headerSecret = req.headers.get("x-cron-secret")?.trim();

    if (!secret || !headerSecret || headerSecret !== secret) {
      return jsonError(403, "AUTH_FORBIDDEN", "Forbidden");
    }

    const body = await req.json().catch(() => null);
    const dryRun = Boolean(body && typeof body === "object" ? body.dryRun : false);
    if (body && typeof body === "object" && body.dryRun !== undefined && typeof body.dryRun !== "boolean") {
      return jsonError(400, "VALIDATION_ERROR", "dryRun must be boolean");
    }

    const result = await runDailyCron({ dryRun, requestedBy: "cron" });
    return NextResponse.json(result);
  } catch {
    return jsonError(500, "INTERNAL_ERROR", "Internal server error");
  }
}
