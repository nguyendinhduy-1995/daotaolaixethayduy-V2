import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError } from "@/lib/api-response";
import { requireMappedRoutePermissionAuth } from "@/lib/route-auth";
import { requireAdminRole } from "@/lib/admin-auth";

const ALLOWED_STATUS = new Set(["PRESENT", "HALF", "OFF", "LEAVE_PAID", "LEAVE_UNPAID", "LATE", "ABSENT"]);
const ALLOWED_SOURCE = new Set(["MANUAL", "IMPORT", "DEVICE"]);

function parsePositiveInt(value: string | null, fallback: number, max = 100) {
  if (value === null) return fallback;
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) throw new Error("INVALID_PAGINATION");
  return Math.min(n, max);
}

function monthRange(month: string) {
  const from = new Date(`${month}-01T00:00:00.000Z`);
  const [y, m] = month.split("-").map(Number);
  const to = new Date(Date.UTC(y, m, 1));
  return { from, to };
}

export async function GET(req: Request) {
  const auth = await requireMappedRoutePermissionAuth(req);
  if (auth.error) return auth.error;
  const adminError = requireAdminRole(auth.auth.role);
  if (adminError) return adminError;

  try {
    const { searchParams } = new URL(req.url);
    const page = parsePositiveInt(searchParams.get("page"), 1);
    const pageSize = parsePositiveInt(searchParams.get("pageSize"), 31);
    const branchId = searchParams.get("branchId") || undefined;
    const userId = searchParams.get("userId") || undefined;
    const month = searchParams.get("month") || "";

    const where: Record<string, unknown> = {
      ...(branchId ? { branchId } : {}),
      ...(userId ? { userId } : {}),
    };

    if (/^\d{4}-\d{2}$/.test(month)) {
      const { from, to } = monthRange(month);
      where.date = { gte: from, lt: to };
    }

    const [items, total] = await Promise.all([
      prisma.attendance.findMany({
        where,
        include: {
          user: { select: { id: true, name: true, email: true } },
          branch: { select: { id: true, name: true } },
        },
        orderBy: [{ date: "asc" }, { createdAt: "desc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.attendance.count({ where }),
    ]);

    return NextResponse.json({ items, page, pageSize, total });
  } catch (err) {
    console.error("[admin.attendance]", err);
    return jsonError(500, "INTERNAL_ERROR", "Internal server error");
  }
}

export async function POST(req: Request) {
  const auth = await requireMappedRoutePermissionAuth(req);
  if (auth.error) return auth.error;
  const adminError = requireAdminRole(auth.auth.role);
  if (adminError) return adminError;

  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") return jsonError(400, "VALIDATION_ERROR", "Invalid JSON body");

    const userId = typeof body.userId === "string" ? body.userId : "";
    const branchId = typeof body.branchId === "string" ? body.branchId : "";
    const status = typeof body.status === "string" ? body.status.toUpperCase() : "";
    const source = typeof body.source === "string" ? body.source.toUpperCase() : "MANUAL";
    const date = typeof body.date === "string" ? new Date(body.date) : null;

    if (!userId || !branchId || !date || Number.isNaN(date.getTime()) || !ALLOWED_STATUS.has(status) || !ALLOWED_SOURCE.has(source)) {
      return jsonError(400, "VALIDATION_ERROR", "Invalid payload");
    }

    const attendance = await prisma.attendance.upsert({
      where: { userId_date: { userId, date } },
      create: {
        userId,
        branchId,
        date,
        status: status as never,
        source: source as never,
        minutesLate: Number.isInteger(body.minutesLate) ? body.minutesLate : null,
        note: typeof body.note === "string" ? body.note : null,
      },
      update: {
        branchId,
        status: status as never,
        source: source as never,
        minutesLate: Number.isInteger(body.minutesLate) ? body.minutesLate : null,
        note: typeof body.note === "string" ? body.note : null,
      },
    });

    return NextResponse.json({ attendance });
  } catch (err) {
    console.error("[admin.attendance]", err);
    return jsonError(500, "INTERNAL_ERROR", "Internal server error");
  }
}
