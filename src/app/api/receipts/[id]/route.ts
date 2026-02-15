import { NextResponse } from "next/server";
import type { ReceiptMethod } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { jsonError } from "@/lib/api-response";
import { requireRouteAuth } from "@/lib/route-auth";
import { isAdminRole } from "@/lib/admin-auth";
import { KpiDateError, resolveKpiDateParam } from "@/lib/services/kpi-daily";

type ReceiptInputMethod = "cash" | "bank" | "momo" | "other" | "bank_transfer" | "card";
type RouteContext = { params: Promise<{ id: string }> | { id: string } };

function dayRangeInHoChiMinh(dateStr: string) {
  const start = new Date(`${dateStr}T00:00:00.000+07:00`);
  const end = new Date(`${dateStr}T23:59:59.999+07:00`);
  return { start, end };
}

function parseReceiptMethod(value: unknown): ReceiptMethod {
  if (typeof value !== "string") throw new Error("INVALID_METHOD");
  const method = value as ReceiptInputMethod;

  if (method === "cash") return "cash";
  if (method === "bank" || method === "bank_transfer") return "bank_transfer";
  if (method === "card") return "card";
  if (method === "momo" || method === "other") return "other";

  throw new Error("INVALID_METHOD");
}

function parseAmount(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0 || !Number.isInteger(value)) {
    throw new Error("INVALID_AMOUNT");
  }
  return value;
}

function parseReceivedAt(value: unknown) {
  if (typeof value !== "string") throw new Error("INVALID_DATE");
  const date = resolveKpiDateParam(value);
  return dayRangeInHoChiMinh(date).start;
}

export async function GET(req: Request, context: RouteContext) {
  const authResult = requireRouteAuth(req);
  if (authResult.error) return authResult.error;

  try {
    const { id } = await Promise.resolve(context.params);
    const receipt = await prisma.receipt.findUnique({
      where: { id },
      include: { student: { include: { lead: { select: { ownerId: true } } } } },
    });
    if (!receipt) return jsonError(404, "NOT_FOUND", "Receipt not found");
    if (!isAdminRole(authResult.auth.role) && receipt.student.lead.ownerId !== authResult.auth.sub) {
      return jsonError(403, "AUTH_FORBIDDEN", "Forbidden");
    }
    return NextResponse.json({ receipt });
  } catch {
    return jsonError(500, "INTERNAL_ERROR", "Internal server error");
  }
}

export async function PATCH(req: Request, context: RouteContext) {
  const authResult = requireRouteAuth(req);
  if (authResult.error) return authResult.error;

  try {
    const { id } = await Promise.resolve(context.params);
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return jsonError(400, "VALIDATION_ERROR", "Invalid JSON body");
    }

    const exists = await prisma.receipt.findUnique({
      where: { id },
      select: { id: true, student: { select: { lead: { select: { ownerId: true } } } } },
    });
    if (!exists) return jsonError(404, "NOT_FOUND", "Receipt not found");
    if (!isAdminRole(authResult.auth.role) && exists.student.lead.ownerId !== authResult.auth.sub) {
      return jsonError(403, "AUTH_FORBIDDEN", "Forbidden");
    }

    const data: {
      amount?: number;
      method?: ReceiptMethod;
      note?: string | null;
      receivedAt?: Date;
    } = {};

    if (body.amount !== undefined) data.amount = parseAmount(body.amount);
    if (body.method !== undefined) data.method = parseReceiptMethod(body.method);
    if (body.note !== undefined) data.note = typeof body.note === "string" ? body.note : null;
    if (body.receivedAt !== undefined) data.receivedAt = parseReceivedAt(body.receivedAt);

    const receipt = await prisma.receipt.update({
      where: { id },
      data,
    });

    return NextResponse.json({ receipt });
  } catch (error) {
    if (error instanceof KpiDateError) {
      return jsonError(400, "VALIDATION_ERROR", error.message);
    }
    if (
      error instanceof Error &&
      (error.message === "INVALID_AMOUNT" || error.message === "INVALID_METHOD" || error.message === "INVALID_DATE")
    ) {
      return jsonError(400, "VALIDATION_ERROR", "Invalid receipt input");
    }
    return jsonError(500, "INTERNAL_ERROR", "Internal server error");
  }
}
