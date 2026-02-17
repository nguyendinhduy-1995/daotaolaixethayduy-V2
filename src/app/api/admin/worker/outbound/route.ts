import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-response";
import { requirePermissionRouteAuth } from "@/lib/route-auth";
import { runWorkerOnce } from "@/lib/services/outbound-worker";
import { API_ERROR_VI } from "@/lib/api-error-vi";

export async function POST(req: Request) {
  const authResult = await requirePermissionRouteAuth(req, { module: "admin_send_progress", action: "RUN" });
  if (authResult.error) return authResult.error;

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
    return jsonError(500, "INTERNAL_ERROR", API_ERROR_VI.internal);
  }
}
