import { NextResponse } from "next/server";
import type { OutboundChannel } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { jsonError } from "@/lib/api-response";
import { requireRouteAuth } from "@/lib/route-auth";
import { ensureOutboundSchema } from "@/lib/outbound-db";

const CHANNELS: OutboundChannel[] = ["ZALO", "FB", "SMS", "CALL_NOTE"];

function isChannel(value: string | null): value is OutboundChannel {
  return value !== null && CHANNELS.includes(value as OutboundChannel);
}

export async function GET(req: Request) {
  const authResult = requireRouteAuth(req);
  if (authResult.error) return authResult.error;

  try {
    await ensureOutboundSchema();
    const { searchParams } = new URL(req.url);
    const channel = searchParams.get("channel");
    if (channel !== null && !isChannel(channel)) {
      return jsonError(400, "VALIDATION_ERROR", "Invalid channel");
    }

    const items = await prisma.messageTemplate.findMany({
      where: {
        isActive: true,
        ...(channel ? { channel } : {}),
      },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ items });
  } catch {
    return jsonError(500, "INTERNAL_ERROR", "Internal server error");
  }
}
