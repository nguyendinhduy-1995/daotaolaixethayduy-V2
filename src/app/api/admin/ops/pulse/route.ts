import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-response";
import { requireMappedRoutePermissionAuth } from "@/lib/route-auth";
import { requireAdminRole } from "@/lib/admin-auth";
import { listOpsPulse } from "@/lib/services/ops-pulse";

export async function GET(req: Request) {
  const authResult = await requireMappedRoutePermissionAuth(req);
  if (authResult.error) return authResult.error;
  const adminError = requireAdminRole(authResult.auth.role);
  if (adminError) return adminError;

  try {
    const { searchParams } = new URL(req.url);
    const roleRaw = searchParams.get("role");
    const role = roleRaw === "PAGE" || roleRaw === "TELESALES" ? roleRaw : undefined;
    const ownerId = searchParams.get("ownerId") || undefined;
    const dateKey = searchParams.get("dateKey") || undefined;
    const limitRaw = searchParams.get("limit");
    const limit = limitRaw ? Number(limitRaw) : undefined;

    if (limitRaw && (!Number.isInteger(limit) || (limit as number) <= 0)) {
      return jsonError(400, "VALIDATION_ERROR", "limit must be a positive integer");
    }

    const data = await listOpsPulse({ role, ownerId, dateKey, limit });
    return NextResponse.json(data);
  } catch (err) {
    console.error("[admin.ops.pulse]", err);
    return jsonError(500, "INTERNAL_ERROR", "Internal server error");
  }
}
