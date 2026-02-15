import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { jsonError } from "@/lib/api-response";
import { requireRouteAuth } from "@/lib/route-auth";
import { requireAdminRole } from "@/lib/admin-auth";

function parsePositiveInt(value: string | null, fallback: number, max = 100) {
  if (value === null) return fallback;
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) throw new Error("INVALID_PAGINATION");
  return Math.min(n, max);
}

function parseBooleanFilter(value: string | null) {
  if (value === null) return undefined;
  if (value === "true") return true;
  if (value === "false") return false;
  throw new Error("INVALID_BOOLEAN");
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
    const q = searchParams.get("q")?.trim();
    const isActive = parseBooleanFilter(searchParams.get("isActive"));

    const where: Prisma.BranchWhereInput = {
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { code: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
      ...(isActive !== undefined ? { isActive } : {}),
    };

    const [items, total] = await Promise.all([
      prisma.branch.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.branch.count({ where }),
    ]);
    return NextResponse.json({ items, page, pageSize, total });
  } catch (error) {
    if (error instanceof Error && (error.message === "INVALID_PAGINATION" || error.message === "INVALID_BOOLEAN")) {
      return jsonError(400, "VALIDATION_ERROR", "Invalid query params");
    }
    return jsonError(500, "INTERNAL_ERROR", "Internal server error");
  }
}

export async function POST(req: Request) {
  const auth = requireRouteAuth(req);
  if (auth.error) return auth.error;
  const adminError = requireAdminRole(auth.auth.role);
  if (adminError) return adminError;

  try {
    const body = await req.json().catch(() => null);
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    const code = typeof body?.code === "string" ? body.code.trim().toUpperCase() : "";
    if (!name) return jsonError(400, "VALIDATION_ERROR", "name is required");
    if (code.length > 32) return jsonError(400, "VALIDATION_ERROR", "code must be at most 32 characters");

    const branch = await prisma.branch.create({
      data: {
        name,
        code: code || null,
        isActive: typeof body?.isActive === "boolean" ? body.isActive : true,
        commissionPerPaid50:
          Number.isInteger(body?.commissionPerPaid50) && body.commissionPerPaid50 >= 0
            ? body.commissionPerPaid50
            : null,
      },
    });
    return NextResponse.json({ branch });
  } catch (error) {
    if ((error as { code?: string })?.code === "P2002") {
      return jsonError(400, "VALIDATION_ERROR", "Branch code already exists");
    }
    return jsonError(500, "INTERNAL_ERROR", "Internal server error");
  }
}
