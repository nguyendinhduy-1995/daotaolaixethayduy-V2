import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError } from "@/lib/api-response";
import { ensureOutboundSchema } from "@/lib/outbound-db";

type CallbackStatus = "SENT" | "FAILED" | "SKIPPED";

function isCallbackStatus(value: unknown): value is CallbackStatus {
  return value === "SENT" || value === "FAILED" || value === "SKIPPED";
}

function nextBackoffTime(retryCount: number) {
  const minute = 60 * 1000;
  const delays = [2 * minute, 10 * minute, 60 * minute];
  const delay = delays[Math.max(0, Math.min(retryCount - 1, delays.length - 1))];
  return new Date(Date.now() + delay);
}

export async function POST(req: Request) {
  try {
    await ensureOutboundSchema();

    const callbackSecret = process.env.N8N_CALLBACK_SECRET?.trim();
    const headerSecret = req.headers.get("x-callback-secret")?.trim();
    if (!callbackSecret || !headerSecret || headerSecret !== callbackSecret) {
      return jsonError(401, "AUTH_INVALID_TOKEN", "Invalid callback secret");
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return jsonError(400, "VALIDATION_ERROR", "Invalid JSON body");
    }

    const messageId = typeof body.messageId === "string" ? body.messageId : "";
    const status = body.status;
    if (!messageId || !isCallbackStatus(status)) {
      return jsonError(400, "VALIDATION_ERROR", "messageId and status are required");
    }

    const message = await prisma.outboundMessage.findUnique({
      where: { id: messageId },
      select: { id: true, retryCount: true },
    });
    if (!message) {
      return jsonError(404, "NOT_FOUND", "Outbound message not found");
    }

    const providerMessageId = typeof body.providerMessageId === "string" ? body.providerMessageId.trim() : null;
    const errorText = typeof body.error === "string" ? body.error.trim() : null;
    const sentAt =
      typeof body.sentAt === "string" && body.sentAt.trim().length > 0 ? new Date(body.sentAt) : new Date();

    if (status === "SENT") {
      if (Number.isNaN(sentAt.getTime())) {
        return jsonError(400, "VALIDATION_ERROR", "sentAt is invalid");
      }
      await prisma.outboundMessage.update({
        where: { id: messageId },
        data: {
          status: "SENT",
          sentAt,
          providerMessageId: providerMessageId || null,
          error: null,
          nextAttemptAt: null,
        },
      });
      return NextResponse.json({ ok: true });
    }

    if (status === "FAILED") {
      const nextRetry = message.retryCount + 1;
      await prisma.outboundMessage.update({
        where: { id: messageId },
        data: {
          status: "FAILED",
          error: errorText || "Callback failed",
          providerMessageId: providerMessageId || null,
          retryCount: nextRetry,
          nextAttemptAt: nextBackoffTime(nextRetry),
        },
      });
      return NextResponse.json({ ok: true });
    }

    await prisma.outboundMessage.update({
      where: { id: messageId },
      data: {
        status: "SKIPPED",
        providerMessageId: providerMessageId || null,
        error: errorText || null,
        nextAttemptAt: null,
      },
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[outbound.callback]", err);
    return jsonError(500, "INTERNAL_ERROR", "Internal server error");
  }
}
