import { type OutboundJobStatus } from "@prisma/client";
import { jsonError } from "@/lib/api-response";
import { API_ERROR_VI } from "@/lib/api-error-vi";
import { requireIdempotencyKey, withIdempotency } from "@/lib/idempotency";
import { prisma } from "@/lib/prisma";
import { requireServiceToken } from "@/lib/service-token";

const JOB_STATUSES: OutboundJobStatus[] = ["NEW", "DISPATCHED", "DONE", "FAILED"];

function parseStatus(value: unknown): OutboundJobStatus {
  const normalized = String(value || "")
    .trim()
    .toUpperCase() as OutboundJobStatus;
  if (!JOB_STATUSES.includes(normalized)) {
    throw new Error("INVALID_STATUS");
  }
  return normalized;
}

export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  const serviceToken = requireServiceToken(req);
  if (serviceToken.error) return serviceToken.error;

  try {
    const { id } = await context.params;
    if (!id) return jsonError(400, "VALIDATION_ERROR", API_ERROR_VI.required);

    const idempotency = requireIdempotencyKey(req);
    if (idempotency.error) return idempotency.error;

    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) return jsonError(400, "VALIDATION_ERROR", API_ERROR_VI.required);

    const route = new URL(req.url).pathname;
    return (
      await withIdempotency({
        key: idempotency.key!,
        route,
        actorType: "service",
        actorId: "outbound_job_status",
        requestBody: body,
        execute: async () => {
          const existing = await prisma.outboundJob.findUnique({
            where: { id },
            select: {
              id: true,
              branchId: true,
              suggestionId: true,
              taskId: true,
            },
          });
          if (!existing) {
            return {
              statusCode: 404,
              responseJson: {
                ok: false,
                error: { code: "NOT_FOUND", message: "Không tìm thấy danh sách gọi" },
              },
            };
          }

          const status = parseStatus(body.status);
          const runId = typeof body.runId === "string" && body.runId.trim() ? body.runId.trim() : null;
          const lastError = typeof body.lastError === "string" && body.lastError.trim() ? body.lastError.trim() : null;
          const now = new Date();

          const updated = await prisma.outboundJob.update({
            where: { id },
            data: {
              status,
              runId,
              lastError,
              dispatchedAt: status === "DISPATCHED" ? now : undefined,
              doneAt: status === "DONE" ? now : undefined,
            },
          });

          if (status === "DONE" && existing.taskId) {
            await prisma.notification.updateMany({
              where: { id: existing.taskId, status: { not: "DONE" } },
              data: { status: "DONE" },
            });
          }

          await prisma.automationLog.create({
            data: {
              branchId: existing.branchId,
              channel: "n8n",
              milestone: "outbound-job-status",
              status: status === "FAILED" ? "failed" : status === "DONE" ? "sent" : "skipped",
              payload: {
                source: "n8n",
                outboundJobId: existing.id,
                suggestionId: existing.suggestionId,
                taskId: existing.taskId,
                status,
                runId,
                lastError,
                updatedAt: now.toISOString(),
              },
            },
          });

          return { statusCode: 200, responseJson: { ok: true, job: updated } as Record<string, unknown> };
        },
      })
    ).response;
  } catch (error) {
    if (error instanceof Error && error.message === "INVALID_STATUS") {
      return jsonError(400, "VALIDATION_ERROR", "Trạng thái danh sách gọi không hợp lệ");
    }
    return jsonError(500, "INTERNAL_ERROR", API_ERROR_VI.internal);
  }
}
