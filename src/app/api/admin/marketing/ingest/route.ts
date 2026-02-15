import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-response";
import { requireRouteAuth } from "@/lib/route-auth";
import { requireAdminRole } from "@/lib/admin-auth";
import { upsertMarketingMetric, validateMarketingInput } from "@/lib/services/marketing-metrics";

export async function POST(req: Request) {
  const authResult = requireRouteAuth(req);
  if (authResult.error) return authResult.error;
  const roleError = requireAdminRole(authResult.auth.role);
  if (roleError) return roleError;

  try {
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
