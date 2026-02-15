import { NextResponse } from "next/server";
import { requireRouteAuth } from "@/lib/route-auth";
import { requireAdminRole } from "@/lib/admin-auth";
import {
  N8N_DEFINITIONS,
  N8N_INGEST_ENDPOINTS,
  N8N_SECURITY_GUIDELINES,
  N8N_WORKFLOWS,
} from "@/lib/n8n-workflows";
import { jsonError } from "@/lib/api-response";

export async function GET(req: Request) {
  const authResult = requireRouteAuth(req);
  if (authResult.error) return authResult.error;
  const adminError = requireAdminRole(authResult.auth.role);
  if (adminError) return adminError;

  try {
    return NextResponse.json({
      ok: true,
      definitions: N8N_DEFINITIONS,
      securityGuidelines: N8N_SECURITY_GUIDELINES,
      ingestEndpoints: N8N_INGEST_ENDPOINTS,
      workflows: N8N_WORKFLOWS,
    });
  } catch {
    return jsonError(500, "INTERNAL_ERROR", "Internal server error");
  }
}

