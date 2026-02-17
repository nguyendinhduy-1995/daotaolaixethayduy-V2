import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-response";
import { requireMappedRoutePermissionAuth } from "@/lib/route-auth";
import { requireAdminRole } from "@/lib/admin-auth";
import { isGenerateScope, runNotificationGenerate } from "@/lib/services/notification-generate";

export async function POST(req: Request) {
  const authResult = await requireMappedRoutePermissionAuth(req);
  if (authResult.error) return authResult.error;
  const adminError = requireAdminRole(authResult.auth.role);
  if (adminError) return adminError;

  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object" || !isGenerateScope(body.scope)) {
      return jsonError(400, "VALIDATION_ERROR", "Invalid generate input");
    }
    if (body.dryRun !== undefined && typeof body.dryRun !== "boolean") {
      return jsonError(400, "VALIDATION_ERROR", "dryRun must be boolean");
    }

    const result = await runNotificationGenerate(body.scope, Boolean(body.dryRun));
    return NextResponse.json(result);
  } catch (err) {
    console.error("[notifications.generate]", err);
    return jsonError(500, "INTERNAL_ERROR", "Internal server error");
  }
}
