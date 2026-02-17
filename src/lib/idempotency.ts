import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { jsonError } from "@/lib/api-response";
import { hashPayload } from "@/lib/utils/hash";

export type IdempotencyActorType = "user" | "service";
const IDEMPOTENCY_TTL_MS = 72 * 60 * 60 * 1000;

export function hashRequestBody(body: unknown): string {
  return hashPayload(body);
}

export function requireIdempotencyKey(req: Request) {
  const key = req.headers.get("Idempotency-Key")?.trim();
  if (!key) {
    return {
      key: null,
      error: jsonError(400, "VALIDATION_ERROR", "Thiếu Idempotency-Key"),
    };
  }
  return { key, error: null };
}

export async function withIdempotency<T extends Record<string, unknown>>(input: {
  key: string;
  route: string;
  actorType: IdempotencyActorType;
  actorId: string;
  requestBody: unknown;
  execute: () => Promise<{ statusCode: number; responseJson: T }>;
}) {
  // Probabilistic cleanup: ~1% of requests clean up expired entries
  // instead of running deleteMany on every single request.
  if (Math.random() < 0.01) {
    await prisma.idempotencyRequest.deleteMany({
      where: { createdAt: { lt: new Date(Date.now() - IDEMPOTENCY_TTL_MS) } },
    });
  }

  const requestHash = hashRequestBody(input.requestBody);
  const existing = await prisma.idempotencyRequest.findUnique({
    where: {
      key_route_actorType_actorId: {
        key: input.key,
        route: input.route,
        actorType: input.actorType,
        actorId: input.actorId,
      },
    },
  });

  if (existing) {
    if (existing.requestHash !== requestHash) {
      return {
        response: jsonError(409, "IDEMPOTENCY_CONFLICT", "Idempotency-Key đã được dùng với payload khác"),
      };
    }
    return {
      response: NextResponse.json(existing.responseJson, { status: existing.statusCode }),
    };
  }

  const result = await input.execute();
  await prisma.idempotencyRequest.create({
    data: {
      key: input.key,
      route: input.route,
      actorType: input.actorType,
      actorId: input.actorId,
      requestHash,
      responseJson: result.responseJson as Prisma.InputJsonValue,
      statusCode: result.statusCode,
    },
  });

  return {
    response: NextResponse.json(result.responseJson, { status: result.statusCode }),
  };
}
