import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError } from "@/lib/api-response";
import { requireMappedRoutePermissionAuth } from "@/lib/route-auth";
import { requireAdminRole } from "@/lib/admin-auth";

function parsePositiveInt(value: string | null, fallback: number, max = 100) {
  if (value === null) return fallback;
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) throw new Error("INVALID_PAGINATION");
  return Math.min(n, max);
}

export async function GET(req: Request) {
  const auth = await requireMappedRoutePermissionAuth(req);
  if (auth.error) return auth.error;
  const adminError = requireAdminRole(auth.auth.role);
  if (adminError) return adminError;

  try {
    const { searchParams } = new URL(req.url);
    const page = parsePositiveInt(searchParams.get("page"), 1);
    const pageSize = parsePositiveInt(searchParams.get("pageSize"), 20);
    const userId = searchParams.get("userId") || undefined;
    const branchId = searchParams.get("branchId") || undefined;
    const month = searchParams.get("month") || undefined;

    const where = {
      ...(userId ? { userId } : {}),
      ...(branchId ? { branchId } : {}),
      ...(month
        ? {
            effectiveFrom: { lte: new Date(`${month}-31T23:59:59.000Z`) },
            OR: [{ effectiveTo: null }, { effectiveTo: { gte: new Date(`${month}-01T00:00:00.000Z`) } }],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      prisma.salaryProfile.findMany({
        where,
        include: {
          user: { select: { id: true, name: true, email: true } },
          branch: { select: { id: true, name: true } },
          commissionScheme: { select: { id: true, name: true } },
        },
        orderBy: { effectiveFrom: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.salaryProfile.count({ where }),
    ]);

    return NextResponse.json({ items, page, pageSize, total });
  } catch {
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
    const roleTitle = typeof body.roleTitle === "string" ? body.roleTitle.trim() : "";
    const baseSalaryVnd = Number(body.baseSalaryVnd);
    const allowanceVnd = body.allowanceVnd === undefined ? 0 : Number(body.allowanceVnd);
    const standardDays = Number(body.standardDays);
    const effectiveFrom = typeof body.effectiveFrom === "string" ? new Date(body.effectiveFrom) : null;

    if (!userId || !branchId || !roleTitle || !Number.isInteger(baseSalaryVnd) || baseSalaryVnd < 0 || !Number.isInteger(allowanceVnd) || allowanceVnd < 0 || !Number.isInteger(standardDays) || standardDays <= 0 || !effectiveFrom || Number.isNaN(effectiveFrom.getTime())) {
      return jsonError(400, "VALIDATION_ERROR", "Invalid payload");
    }

    const profile = await prisma.salaryProfile.create({
      data: {
        userId,
        branchId,
        roleTitle,
        baseSalaryVnd,
        allowanceVnd,
        standardDays,
        commissionSchemeId: typeof body.commissionSchemeId === "string" ? body.commissionSchemeId : null,
        effectiveFrom,
        effectiveTo: typeof body.effectiveTo === "string" ? new Date(body.effectiveTo) : null,
      },
    });

    return NextResponse.json({ profile });
  } catch {
    return jsonError(500, "INTERNAL_ERROR", "Internal server error");
  }
}
