import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-response";
import { requireRouteAuth } from "@/lib/route-auth";
import { requireAdminRole } from "@/lib/admin-auth";
import { getSchedulerHealth } from "@/lib/services/scheduler-health";

export async function GET(req: Request) {
  const authResult = requireRouteAuth(req);
  if (authResult.error) return authResult.error;
  const roleError = requireAdminRole(authResult.auth.role);
  if (roleError) return roleError;

  try {
    const payload = await getSchedulerHealth(authResult.auth);
    return NextResponse.json(payload);
  } catch {
    return jsonError(500, "INTERNAL_ERROR", "Internal server error");
  }
}
