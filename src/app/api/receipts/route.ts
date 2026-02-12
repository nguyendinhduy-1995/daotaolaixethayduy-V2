import { NextResponse } from "next/server";
import type { Prisma, ReceiptMethod } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { jsonError } from "@/lib/api-response";
import { requireRouteAuth } from "@/lib/route-auth";
import { KpiDateError, resolveKpiDateParam } from "@/lib/services/kpi-daily";

type ReceiptInputMethod = "cash" | "bank" | "momo" | "other" | "bank_transfer" | "card";

function parsePositiveInt(value: string | null, fallback: number, max = 100) {
  if (value === null) return fallback;
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) throw new Error("INVALID_PAGINATION");
  return Math.min(n, max);
}

function dayRangeInHoChiMinh(dateStr: string) {
  const start = new Date(`${dateStr}T00:00:00.000+07:00`);
  const end = new Date(`${dateStr}T23:59:59.999+07:00`);
  return { start, end };
}

function parseReceiptMethod(value: unknown): ReceiptMethod | undefined {
  if (value === undefined) return undefined;
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
  if (value === undefined) return undefined;
  if (typeof value !== "string") throw new Error("INVALID_DATE");
  const date = resolveKpiDateParam(value);
  return dayRangeInHoChiMinh(date).start;
}

export async function POST(req: Request) {
  const authResult = requireRouteAuth(req);
  if (authResult.error) return authResult.error;

  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return jsonError(400, "VALIDATION_ERROR", "Invalid JSON body");
    }
    if (!body.studentId || typeof body.studentId !== "string") {
      return jsonError(400, "VALIDATION_ERROR", "studentId is required");
    }

    const student = await prisma.student.findUnique({
      where: { id: body.studentId },
      select: { id: true },
    });
    if (!student) return jsonError(404, "NOT_FOUND", "Student not found");

    const amount = parseAmount(body.amount);
    const method = parseReceiptMethod(body.method) ?? "cash";
    const receivedAt = parseReceivedAt(body.receivedAt);

    const receipt = await prisma.receipt.create({
      data: {
        studentId: body.studentId,
        amount,
        method,
        note: typeof body.note === "string" ? body.note : null,
        ...(receivedAt ? { receivedAt } : {}),
        createdById: authResult.auth.sub,
      },
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

export async function GET(req: Request) {
  const authResult = requireRouteAuth(req);
  if (authResult.error) return authResult.error;

  try {
    const { searchParams } = new URL(req.url);
    const studentId = searchParams.get("studentId");
    const date = searchParams.get("date");
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const page = parsePositiveInt(searchParams.get("page"), 1);
    const pageSize = parsePositiveInt(searchParams.get("pageSize"), 20);

    if (date && (from || to)) {
      return jsonError(400, "VALIDATION_ERROR", "Use either date or from/to");
    }

    let receivedAt: Prisma.DateTimeFilter | undefined;
    if (date) {
      const resolved = resolveKpiDateParam(date);
      const range = dayRangeInHoChiMinh(resolved);
      receivedAt = { gte: range.start, lte: range.end };
    } else if (from || to) {
      receivedAt = {};
      if (from) {
        const resolvedFrom = resolveKpiDateParam(from);
        receivedAt.gte = dayRangeInHoChiMinh(resolvedFrom).start;
      }
      if (to) {
        const resolvedTo = resolveKpiDateParam(to);
        receivedAt.lte = dayRangeInHoChiMinh(resolvedTo).end;
      }
    }

    const where: Prisma.ReceiptWhereInput = {
      ...(studentId ? { studentId } : {}),
      ...(receivedAt ? { receivedAt } : {}),
    };

    const [items, total] = await Promise.all([
      prisma.receipt.findMany({
        where,
        orderBy: { receivedAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.receipt.count({ where }),
    ]);

    return NextResponse.json({ items, page, pageSize, total });
  } catch (error) {
    if (error instanceof KpiDateError) {
      return jsonError(400, "VALIDATION_ERROR", error.message);
    }
    if (error instanceof Error && error.message === "INVALID_PAGINATION") {
      return jsonError(400, "VALIDATION_ERROR", "Invalid pagination");
    }
    return jsonError(500, "INTERNAL_ERROR", "Internal server error");
  }
}
