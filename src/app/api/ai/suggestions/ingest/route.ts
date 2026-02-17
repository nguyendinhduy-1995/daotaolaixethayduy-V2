import { jsonError } from "@/lib/api-response";
import { API_ERROR_VI } from "@/lib/api-error-vi";
import { requireIdempotencyKey, withIdempotency } from "@/lib/idempotency";
import { requireServiceToken } from "@/lib/service-token";
import { AiCoachValidationError, ingestAiSuggestions } from "@/lib/services/ai-kpi-coach";

export async function POST(req: Request) {
  try {
    const serviceToken = requireServiceToken(req);
    if (serviceToken.error) return serviceToken.error;

    const idempotency = requireIdempotencyKey(req);
    if (idempotency.error) return idempotency.error;

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return jsonError(400, "VALIDATION_ERROR", API_ERROR_VI.required);
    }

    const payload = body as Record<string, unknown>;
    const route = new URL(req.url).pathname;

    return (
      await withIdempotency({
        key: idempotency.key!,
        route,
        actorType: "service",
        actorId: "ai_suggestions_ingest",
        requestBody: payload,
        execute: async () => {
          const suggestionsRaw = Array.isArray(payload.suggestions)
            ? payload.suggestions
            : [
                {
                  dateKey: payload.dateKey,
                  role: payload.role,
                  branchId: payload.branchId,
                  ownerId: payload.ownerId,
                  status: payload.status,
                  title: payload.title,
                  content: payload.content,
                  scoreColor: payload.scoreColor,
                  actionsJson: payload.actionsJson,
                  metricsJson: payload.metricsJson,
                  payloadHash: payload.payloadHash,
                },
              ];

          const result = await ingestAiSuggestions({
            source: String(payload.source || ""),
            runId: String(payload.runId || ""),
            suggestions: suggestionsRaw.map((row) => row as {
              dateKey: string;
              role: string;
              branchId?: string | null;
              ownerId?: string | null;
              status?: string;
              title: string;
              content: string;
              scoreColor: string;
              actionsJson?: unknown;
              metricsJson?: unknown;
              payloadHash?: string;
            }),
          });

          return { statusCode: 200, responseJson: { ok: true, ...result } };
        },
      })
    ).response;
  } catch (error) {
    if (error instanceof AiCoachValidationError) return jsonError(400, "VALIDATION_ERROR", error.message);
    return jsonError(500, "INTERNAL_ERROR", API_ERROR_VI.internal);
  }
}
