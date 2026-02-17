import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-response";
import { requireMappedRoutePermissionAuth } from "@/lib/route-auth";
import { requireAdminRole } from "@/lib/admin-auth";
import { runDailyCron } from "@/lib/services/cron-daily";

export async function POST(req: Request) {
  const authResult = await requireMappedRoutePermissionAuth(req);
  if (authResult.error) return authResult.error;
  const roleError = requireAdminRole(authResult.auth.role);
  if (roleError) return roleError;

  try {
    const body = await req.json().catch(() => null);
    const dryRun = Boolean(body && typeof body === "object" ? body.dryRun : false);
    const force = Boolean(body && typeof body === "object" ? body.force : false);
    if (body && typeof body === "object" && body.dryRun !== undefined && typeof body.dryRun !== "boolean") {
      return jsonError(400, "VALIDATION_ERROR", "dryRun must be boolean");
    }
    if (body && typeof body === "object" && body.force !== undefined && typeof body.force !== "boolean") {
      return jsonError(400, "VALIDATION_ERROR", "force must be boolean");
    }

    const result = await runDailyCron({ dryRun, force, requestedBy: authResult.auth.sub });
    return NextResponse.json(result);
  } catch (err) {
    console.error("[admin.cron.daily]", err);
    return jsonError(500, "INTERNAL_ERROR", "Internal server error");
  }
}
