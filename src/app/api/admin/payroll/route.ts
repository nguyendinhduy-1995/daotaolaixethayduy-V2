import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { jsonError } from "@/lib/api-response";
import { requireAdminRole } from "@/lib/admin-auth";
import { requireRouteAuth } from "@/lib/route-auth";

function parsePositiveInt(value: string | null, fallback: number, max = 100) {
  if (value === null) return fallback;
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) throw new Error("INVALID_PAGINATION");
  return Math.min(n, max);
}

export async function GET(req: Request) {
  const auth = requireRouteAuth(req);
  if (auth.error) return auth.error;
  const adminError = requireAdminRole(auth.auth.role);
  if (adminError) return adminError;

  try {
    const { searchParams } = new URL(req.url);
    const page = parsePositiveInt(searchParams.get("page"), 1);
    const pageSize = parsePositiveInt(searchParams.get("pageSize"), 20);
    const month = searchParams.get("month") || undefined;
    const branchId = searchParams.get("branchId") || undefined;

    const where: Prisma.PayrollRunWhereInput = {
      ...(month ? { month } : {}),
      ...(branchId ? { branchId } : {}),
    };

    const [items, total] = await Promise.all([
      prisma.payrollRun.findMany({
        where,
        include: {
          branch: { select: { id: true, name: true } },
          generatedBy: { select: { id: true, name: true, email: true } },
          items: {
            include: { user: { select: { id: true, name: true, email: true } } },
            orderBy: { totalVnd: "desc" },
          },
        },
        orderBy: [{ month: "desc" }, { createdAt: "desc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.payrollRun.count({ where }),
    ]);

    return NextResponse.json({ items, page, pageSize, total });
  } catch (error) {
    if (error instanceof Error && error.message === "INVALID_PAGINATION") {
      return jsonError(400, "VALIDATION_ERROR", "Phân trang không hợp lệ");
    }
    return jsonError(500, "INTERNAL_ERROR", "Internal server error");
  }
}
