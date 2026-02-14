import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-response";
import { requireRouteAuth } from "@/lib/route-auth";
import { requireAdminRole } from "@/lib/admin-auth";
import { runWorkerOnce } from "@/lib/services/outbound-worker";

export async function POST(req: Request) {
  const authResult = requireRouteAuth(req);
  if (authResult.error) return authResult.error;
  const roleError = requireAdminRole(authResult.auth.role);
  if (roleError) return roleError;

  try {
    const body = await req.json().catch(() => ({}));
    const payload: Record<string, unknown> = body && typeof body === "object" ? (body as Record<string, unknown>) : {};

    const result = await runWorkerOnce({
      dryRun: Boolean(payload.dryRun),
      retryFailedOnly: Boolean(payload.retryFailedOnly),
      force: Boolean(payload.force),
      batchSize: typeof payload.batchSize === "number" ? payload.batchSize : undefined,
      concurrency: typeof payload.concurrency === "number" ? payload.concurrency : undefined,
      requestedBy: authResult.auth.sub,
      logRun: true,
    });

    return NextResponse.json(result);
  } catch {
    return jsonError(500, "INTERNAL_ERROR", "Internal server error");
  }
}
