import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-response";
import { requireAdminRole } from "@/lib/admin-auth";
import { requireMappedRoutePermissionAuth } from "@/lib/route-auth";
import { upsertDailyReport, validateReportInput } from "@/lib/services/marketing";

export async function POST(req: Request) {
  const auth = await requireMappedRoutePermissionAuth(req);
  if (auth.error) return auth.error;
  const adminError = requireAdminRole(auth.auth.role);
  if (adminError) return adminError;

  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return jsonError(400, "VALIDATION_ERROR", "Invalid JSON body");
    }

    const validated = validateReportInput(body as Record<string, unknown>);
    if (!validated.ok) return jsonError(400, "VALIDATION_ERROR", validated.error);

    const item = await upsertDailyReport(validated.data);
    return NextResponse.json({ ok: true, item });
  } catch (err) {
    console.error("[admin.marketing.report]", err);
    return jsonError(500, "INTERNAL_ERROR", "Internal server error");
  }
}
