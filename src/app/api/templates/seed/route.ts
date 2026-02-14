import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-response";
import { requireRouteAuth } from "@/lib/route-auth";
import { requireAdminRole } from "@/lib/admin-auth";
import { ensureDefaultMessageTemplates } from "@/lib/outbound-db";

export async function POST(req: Request) {
  const authResult = requireRouteAuth(req);
  if (authResult.error) return authResult.error;
  const adminError = requireAdminRole(authResult.auth.role);
  if (adminError) return adminError;

  try {
    await ensureDefaultMessageTemplates();
    return NextResponse.json({ ok: true });
  } catch {
    return jsonError(500, "INTERNAL_ERROR", "Internal server error");
  }
}
