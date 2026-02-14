import { NextResponse } from "next/server";
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

export async function POST(req: Request) {
  const authResult = requireRouteAuth(req);
  if (authResult.error) return authResult.error;
  const adminError = requireAdminRole(authResult.auth.role);
  if (adminError) return adminError;

  try {
    await ensureOutboundSchema();
    const body = await req.json().catch(() => ({}));
    const limit = parseLimit((body as { limit?: unknown }).limit);

    const queued = await prisma.outboundMessage.findMany({
      where: { status: "QUEUED" },
      orderBy: { createdAt: "asc" },
      take: limit,
    });

    const webhookUrl = process.env.N8N_WEBHOOK_URL?.trim();
    let sent = 0;
    let failed = 0;

    for (const msg of queued) {
      if (!webhookUrl) {
        await prisma.outboundMessage.update({
          where: { id: msg.id },
          data: {
            status: "SENT",
            sentAt: new Date(),
            error: null,
          },
        });
        sent += 1;
        continue;
      }

      try {
        const res = await fetch(webhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: msg.id,
            channel: msg.channel,
            to: msg.to,
            templateKey: msg.templateKey,
            text: msg.renderedText,
            leadId: msg.leadId,
            studentId: msg.studentId,
          }),
        });

        if (res.ok) {
          await prisma.outboundMessage.update({
            where: { id: msg.id },
            data: { status: "SENT", sentAt: new Date(), error: null },
          });
          sent += 1;
        } else {
          await prisma.outboundMessage.update({
            where: { id: msg.id },
            data: {
              status: "FAILED",
              retryCount: { increment: 1 },
              error: `Webhook status ${res.status}`,
            },
          });
          failed += 1;
        }
      } catch (error) {
        await prisma.outboundMessage.update({
          where: { id: msg.id },
          data: {
            status: "FAILED",
            retryCount: { increment: 1 },
            error: error instanceof Error ? error.message : "Dispatch error",
          },
        });
        failed += 1;
      }
    }

    return NextResponse.json({ total: queued.length, sent, failed });
  } catch (error) {
    if (error instanceof Error && error.message === "INVALID_LIMIT") {
      return jsonError(400, "VALIDATION_ERROR", "Invalid limit");
    }
    return jsonError(500, "INTERNAL_ERROR", "Internal server error");
  }
}
