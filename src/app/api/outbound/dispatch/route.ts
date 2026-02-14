import { NextResponse } from "next/server";
import type { OutboundStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { jsonError } from "@/lib/api-response";
import { requireRouteAuth } from "@/lib/route-auth";
import { requireAdminRole } from "@/lib/admin-auth";
import { ensureOutboundSchema } from "@/lib/outbound-db";

function parseLimit(value: unknown) {
  if (value === undefined) return 20;
  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) throw new Error("INVALID_LIMIT");
  return Math.min(value, 100);
}

function parseFailedOnly(value: unknown) {
  if (value === undefined) return false;
  return value === true;
}

function nextBackoffTime(retryCount: number) {
  const minute = 60 * 1000;
  const delays = [2 * minute, 10 * minute, 60 * minute];
  const delay = delays[Math.max(0, Math.min(retryCount - 1, delays.length - 1))];
  return new Date(Date.now() + delay);
}

async function markFailed(messageId: string, errorMessage: string) {
  const current = await prisma.outboundMessage.findUnique({
    where: { id: messageId },
    select: { retryCount: true },
  });
  const nextRetry = (current?.retryCount ?? 0) + 1;
  await prisma.outboundMessage.update({
    where: { id: messageId },
    data: {
      status: "FAILED",
      retryCount: nextRetry,
      error: errorMessage.slice(0, 500),
      nextAttemptAt: nextBackoffTime(nextRetry),
    },
  });
}

export async function POST(req: Request) {
  const authResult = requireRouteAuth(req);
  if (authResult.error) return authResult.error;
  const adminError = requireAdminRole(authResult.auth.role);
  if (adminError) return adminError;

  try {
    await ensureOutboundSchema();
    const body = await req.json().catch(() => ({}));
    const limit = parseLimit((body as { limit?: unknown }).limit);
    const retryFailedOnly = parseFailedOnly((body as { retryFailedOnly?: unknown }).retryFailedOnly);
    const now = new Date();
    const statuses: OutboundStatus[] = retryFailedOnly ? ["FAILED"] : ["QUEUED", "FAILED"];

    const candidates = await prisma.outboundMessage.findMany({
      where: {
        status: { in: statuses },
        retryCount: { lt: 3 },
        OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }],
      },
      orderBy: { createdAt: "asc" },
      take: limit,
    });

    const webhookUrl = process.env.N8N_WEBHOOK_URL?.trim();
    let accepted = 0;
    let failed = 0;

    for (const msg of candidates) {
      if (!webhookUrl) {
        await prisma.outboundMessage.update({
          where: { id: msg.id },
          data: {
            status: "SENT",
            sentAt: new Date(),
            error: null,
            nextAttemptAt: null,
          },
        });
        accepted += 1;
        continue;
      }

      try {
        const res = await fetch(webhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messageId: msg.id,
            channel: msg.channel,
            to: msg.to,
            text: msg.renderedText,
            leadId: msg.leadId,
            studentId: msg.studentId,
            notificationId: msg.notificationId,
            templateKey: msg.templateKey,
            createdAt: msg.createdAt.toISOString(),
          }),
        });

        if (res.ok) {
          await prisma.outboundMessage.update({
            where: { id: msg.id },
            data: {
              status: "QUEUED",
              error: null,
              nextAttemptAt: nextBackoffTime(1),
            },
          });
          accepted += 1;
        } else {
          await markFailed(msg.id, `Webhook status ${res.status}`);
          failed += 1;
        }
      } catch (error) {
        await markFailed(msg.id, error instanceof Error ? error.message : "Dispatch error");
        failed += 1;
      }
    }

    return NextResponse.json({ total: candidates.length, accepted, failed, webhookEnabled: Boolean(webhookUrl) });
  } catch (error) {
    if (error instanceof Error && error.message === "INVALID_LIMIT") {
      return jsonError(400, "VALIDATION_ERROR", "Invalid limit");
    }
    return jsonError(500, "INTERNAL_ERROR", "Internal server error");
  }
}
