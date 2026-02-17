import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-response";
import { requireMappedRoutePermissionAuth } from "@/lib/route-auth";
import { getSchedulerHealth } from "@/lib/services/scheduler-health";

export async function GET(req: Request) {
  const authResult = await requireMappedRoutePermissionAuth(req);
  if (authResult.error) return authResult.error;

  try {
    const payload = await getSchedulerHealth(authResult.auth);
    return NextResponse.json(payload);
  } catch (err) {
    console.error("[scheduler.health]", err);
    return jsonError(500, "INTERNAL_ERROR", "Internal server error");
  }
}
