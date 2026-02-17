import { NextResponse } from "next/server";
import type { ReceiptMethod } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { jsonError } from "@/lib/api-response";
import { API_ERROR_VI } from "@/lib/api-error-vi";
import { requirePermissionRouteAuth } from "@/lib/route-auth";
import { applyScopeToWhere, resolveScope } from "@/lib/scope";
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
  const authResult = await requirePermissionRouteAuth(req, { module: "receipts", action: "VIEW" });
  if (authResult.error) return authResult.error;

  try {
    const scope = await resolveScope(authResult.auth);
    const { id } = await Promise.resolve(context.params);
    const receipt = await prisma.receipt.findFirst({
      where: applyScopeToWhere({ id }, scope, "receipt"),
      include: { student: { include: { lead: { select: { ownerId: true } } } } },
    });
    if (!receipt) return jsonError(404, "NOT_FOUND", API_ERROR_VI.required);
    return NextResponse.json({ receipt });
  } catch (err) {
    console.error("[receipts.[id]]", err);
    return jsonError(500, "INTERNAL_ERROR", API_ERROR_VI.internal);
  }
}

export async function PATCH(req: Request, context: RouteContext) {
  const authResult = await requirePermissionRouteAuth(req, { module: "receipts", action: "UPDATE" });
  if (authResult.error) return authResult.error;

  try {
    const scope = await resolveScope(authResult.auth);
    const { id } = await Promise.resolve(context.params);
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return jsonError(400, "VALIDATION_ERROR", API_ERROR_VI.required);
    }

    const exists = await prisma.receipt.findFirst({
      where: applyScopeToWhere({ id }, scope, "receipt"),
      select: { id: true, student: { select: { lead: { select: { ownerId: true } } } } },
    });
    if (!exists) return jsonError(404, "NOT_FOUND", API_ERROR_VI.required);

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
      return jsonError(400, "VALIDATION_ERROR", API_ERROR_VI.required);
    }
    return jsonError(500, "INTERNAL_ERROR", API_ERROR_VI.internal);
  }
}
