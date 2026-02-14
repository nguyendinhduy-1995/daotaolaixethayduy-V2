import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-response";
import { runWorkerOnce } from "@/lib/services/outbound-worker";

export async function POST(req: Request) {
  try {
    const secret = process.env.WORKER_SECRET?.trim();
    const headerSecret = req.headers.get("x-worker-secret")?.trim();
    if (!secret || !headerSecret || headerSecret !== secret) {
      return jsonError(403, "AUTH_FORBIDDEN", "Forbidden");
    }

    const body = await req.json().catch(() => ({}));
    const payload: Record<string, unknown> = body && typeof body === "object" ? (body as Record<string, unknown>) : {};

    const boolKeys = ["dryRun", "retryFailedOnly", "force"] as const;
    for (const key of boolKeys) {
      if (payload[key] !== undefined && typeof payload[key] !== "boolean") {
        return jsonError(400, "VALIDATION_ERROR", `${key} must be boolean`);
      }
    }

    const numKeys = ["batchSize", "concurrency"] as const;
    for (const key of numKeys) {
      if (
        payload[key] !== undefined &&
        (typeof payload[key] !== "number" || !Number.isInteger(payload[key]) || payload[key] <= 0)
      ) {
        return jsonError(400, "VALIDATION_ERROR", `${key} must be positive integer`);
      }
    }

    const result = await runWorkerOnce({
      dryRun: typeof payload.dryRun === "boolean" ? payload.dryRun : undefined,
      retryFailedOnly: typeof payload.retryFailedOnly === "boolean" ? payload.retryFailedOnly : undefined,
      force: typeof payload.force === "boolean" ? payload.force : undefined,
      batchSize: typeof payload.batchSize === "number" ? payload.batchSize : undefined,
      concurrency: typeof payload.concurrency === "number" ? payload.concurrency : undefined,
      requestedBy: "worker-secret",
      logRun: true,
    });

    return NextResponse.json(result);
  } catch {
    return jsonError(500, "INTERNAL_ERROR", "Internal server error");
  }
}
