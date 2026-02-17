import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { jsonError } from "@/lib/api-response";
import { requirePermissionRouteAuth } from "@/lib/route-auth";
import { API_ERROR_VI } from "@/lib/api-error-vi";
import { resolveScope } from "@/lib/scope";

function parsePositiveInt(value: string | null, fallback: number, max = 100) {
  if (value === null) return fallback;
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) throw new Error("INVALID_PAGINATION");
  return Math.min(n, max);
}

export async function GET(req: Request) {
  const auth = await requirePermissionRouteAuth(req, { module: "hr_total_payroll", action: "VIEW" });
  if (auth.error) return auth.error;

  try {
    const scope = await resolveScope(auth.auth);
    const { searchParams } = new URL(req.url);
    const page = parsePositiveInt(searchParams.get("page"), 1);
    const pageSize = parsePositiveInt(searchParams.get("pageSize"), 20);
    const month = searchParams.get("month") || undefined;
    const branchId = searchParams.get("branchId") || undefined;

    const where: Prisma.PayrollRunWhereInput = {
      ...(month ? { month } : {}),
      ...(branchId ? { branchId } : {}),
      ...(scope.mode === "BRANCH" && scope.branchId ? { branchId: scope.branchId } : {}),
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
    return jsonError(500, "INTERNAL_ERROR", API_ERROR_VI.internal);
  }
}
