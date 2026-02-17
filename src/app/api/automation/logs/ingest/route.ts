import { type AutomationStatus, type Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-response";
import { API_ERROR_VI } from "@/lib/api-error-vi";
import { requireIdempotencyKey, withIdempotency } from "@/lib/idempotency";
import { prisma } from "@/lib/prisma";
import { requireServiceToken } from "@/lib/service-token";

function parseStatus(value: unknown): AutomationStatus {
  const normalized = String(value || "sent").trim().toLowerCase();
  if (normalized === "sent") return "sent";
  if (normalized === "skipped") return "skipped";
  if (normalized === "failed") return "failed";
  throw new Error("INVALID_STATUS");
}

export async function POST(req: Request) {
  const serviceToken = requireServiceToken(req);
  if (serviceToken.error) return serviceToken.error;

  try {
    const idempotency = requireIdempotencyKey(req);
    if (idempotency.error) return idempotency.error;

    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body || typeof body !== "object") {
      return jsonError(400, "VALIDATION_ERROR", API_ERROR_VI.required);
    }

    const channel = String(body.channel || "").trim();
    const branchId = String(body.branchId || "").trim();
    if (!channel || !branchId) {
      return jsonError(400, "VALIDATION_ERROR", API_ERROR_VI.required);
    }

    const route = new URL(req.url).pathname;
    return (
      await withIdempotency({
        key: idempotency.key!,
        route,
        actorType: "service",
        actorId: "automation_logs_ingest",
        requestBody: body,
        execute: async () => {
          const created = await prisma.automationLog.create({
            data: {
              branchId,
              channel,
              milestone: typeof body.milestone === "string" ? body.milestone : null,
              status: parseStatus(body.status),
              templateKey: typeof body.templateKey === "string" ? body.templateKey : null,
              leadId: typeof body.leadId === "string" ? body.leadId : null,
              studentId: typeof body.studentId === "string" ? body.studentId : null,
              sentAt:
                typeof body.sentAt === "string" && body.sentAt.trim()
                  ? new Date(body.sentAt)
                  : new Date(),
              payload: (body.payload as Prisma.InputJsonValue) ?? null,
            },
          });
          return { statusCode: 200, responseJson: { ok: true, log: created } };
        },
      })
    ).response;
  } catch (error) {
    if (error instanceof Error && error.message === "INVALID_STATUS") {
      return jsonError(400, "VALIDATION_ERROR", "Trạng thái log không hợp lệ");
    }
    return NextResponse.json({ ok: false, error: { code: "INTERNAL_ERROR", message: API_ERROR_VI.internal } }, { status: 500 });
  }
}
