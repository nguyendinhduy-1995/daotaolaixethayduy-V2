import { jsonError } from "@/lib/api-response";
import { requireMappedRoutePermissionAuth } from "@/lib/route-auth";
import { requireAdminRole } from "@/lib/admin-auth";
import { runWorkerOnce } from "@/lib/services/outbound-worker";
import { requireIdempotencyKey, withIdempotency } from "@/lib/idempotency";

function parseLimit(value: unknown) {
  if (value === undefined) return 20;
  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) throw new Error("INVALID_LIMIT");
  return Math.min(value, 100);
}

function parseFailedOnly(value: unknown) {
  if (value === undefined) return false;
  return value === true;
}

export async function POST(req: Request) {
  const authResult = await requireMappedRoutePermissionAuth(req);
  if (authResult.error) return authResult.error;
  const adminError = requireAdminRole(authResult.auth.role);
  if (adminError) return adminError;

  try {
    const idempotency = requireIdempotencyKey(req);
    if (idempotency.error) return idempotency.error;
    const body = await req.json().catch(() => ({}));
    const limit = parseLimit((body as { limit?: unknown }).limit);
    const retryFailedOnly = parseFailedOnly((body as { retryFailedOnly?: unknown }).retryFailedOnly);
    const route = new URL(req.url).pathname;
    return (
      await withIdempotency({
        key: idempotency.key!,
        route,
        actorType: "user",
        actorId: authResult.auth.sub,
        requestBody: body,
        execute: async () => {
          const result = await runWorkerOnce({
            dryRun: false,
            batchSize: limit,
            retryFailedOnly,
            includeFailed: !retryFailedOnly,
            requestedBy: authResult.auth.sub,
            logRun: true,
          });
          return {
            statusCode: 200,
            responseJson: {
              total: result.processed + result.rateLimited,
              accepted: result.sent + result.skipped,
              failed: result.failed,
              webhookEnabled: result.webhookEnabled,
              processed: result.processed,
              sent: result.sent,
              skipped: result.skipped,
              rateLimited: result.rateLimited,
            },
          };
        },
      })
    ).response;
  } catch (error) {
    if (error instanceof Error && error.message === "INVALID_LIMIT") {
      return jsonError(400, "VALIDATION_ERROR", "Giới hạn xử lý không hợp lệ");
    }
    return jsonError(500, "INTERNAL_ERROR", "Lỗi hệ thống");
  }
}
