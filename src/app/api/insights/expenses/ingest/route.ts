import crypto from "node:crypto";
import { jsonError } from "@/lib/api-response";
import { API_ERROR_VI } from "@/lib/api-error-vi";
import { ExpenseValidationError, ingestExpenseInsight } from "@/lib/services/expenses";
import { requireIdempotencyKey, withIdempotency } from "@/lib/idempotency";
import { requireServiceToken } from "@/lib/service-token";

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 60;
const ingestRateLimit = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(key: string) {
  const now = Date.now();
  const current = ingestRateLimit.get(key);
  if (!current || now > current.resetAt) {
    ingestRateLimit.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  if (current.count >= RATE_LIMIT_MAX) return false;
  current.count += 1;
  ingestRateLimit.set(key, current);
  return true;
}

function payloadHash(payload: unknown) {
  return crypto.createHash("sha256").update(JSON.stringify(payload ?? null)).digest("hex");
}

export async function POST(req: Request) {
  try {
    const serviceToken = requireServiceToken(req);
    if (serviceToken.error) return serviceToken.error;
    if (!checkRateLimit(`insights:${serviceToken.token}`)) {
      return jsonError(429, "RATE_LIMITED", "Vượt giới hạn gửi dữ liệu, vui lòng thử lại sau");
    }
    const idempotency = requireIdempotencyKey(req);
    if (idempotency.error) return idempotency.error;

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return jsonError(400, "VALIDATION_ERROR", API_ERROR_VI.required);
    }
    const payload = body as Record<string, unknown>;
    const source = typeof payload.source === "string" ? payload.source.trim().toLowerCase() : "";
    const runId = typeof payload.runId === "string" ? payload.runId.trim() : "";
    if (source !== "n8n" || !runId) {
      return jsonError(400, "VALIDATION_ERROR", "Payload phải có source='n8n' và runId");
    }
    const route = new URL(req.url).pathname;
    return (
      await withIdempotency({
        key: idempotency.key!,
        route,
        actorType: "service",
        actorId: "insights_ingest",
        requestBody: payload,
        execute: async () => {
          const item = await ingestExpenseInsight({
            branchId: typeof payload.branchId === "string" ? payload.branchId : undefined,
            branchCode: typeof payload.branchCode === "string" ? payload.branchCode : undefined,
            dateKey: String(payload.dateKey || payload.date || ""),
            monthKey: String(payload.monthKey || payload.month || ""),
            summary: String(payload.summary || ""),
            payloadJson: payload.payloadJson ?? payload.payload ?? null,
            source: "n8n",
            runId,
            payloadHash: payloadHash(payload.payloadJson ?? payload.payload ?? null),
          });
          return { statusCode: 200, responseJson: { ok: true, item } };
        },
      })
    ).response;
  } catch (error) {
    if (error instanceof ExpenseValidationError) {
      return jsonError(400, "VALIDATION_ERROR", error.message);
    }
    return jsonError(500, "INTERNAL_ERROR", API_ERROR_VI.internal);
  }
}
