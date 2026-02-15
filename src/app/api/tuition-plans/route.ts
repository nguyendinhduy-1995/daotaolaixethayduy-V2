import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { jsonError } from "@/lib/api-response";
import { requireRouteAuth } from "@/lib/route-auth";
import { requireAdminRole } from "@/lib/admin-auth";

function normalizeLicenseType(value: unknown) {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim().toUpperCase();
  if (!normalized) return undefined;
  if (normalized.length > 16) return undefined;
  return normalized;
}

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

function parseAmount(value: unknown) {
  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
    throw new Error("INVALID_AMOUNT");
  }
  return value;
}

export async function GET(req: Request) {
  const authResult = requireRouteAuth(req);
  if (authResult.error) return authResult.error;
  const adminError = requireAdminRole(authResult.auth.role);
  if (adminError) return adminError;

  try {
    const { searchParams } = new URL(req.url);
    const page = parsePositiveInt(searchParams.get("page"), 1);
    const pageSize = parsePositiveInt(searchParams.get("pageSize"), 20);
    const province = searchParams.get("province")?.trim();
    const rawLicenseType = searchParams.get("licenseType");
    const licenseType = rawLicenseType ? normalizeLicenseType(rawLicenseType) : undefined;
    const isActive = parseBooleanFilter(searchParams.get("isActive"));
    const q = searchParams.get("q")?.trim();

    if (rawLicenseType && !licenseType) {
      return jsonError(400, "VALIDATION_ERROR", "Invalid licenseType");
    }

    const where: Prisma.TuitionPlanWhereInput = {
      ...(province ? { province: { contains: province, mode: "insensitive" } } : {}),
      ...(licenseType ? { licenseType: { contains: licenseType, mode: "insensitive" } } : {}),
      ...(isActive !== undefined ? { isActive } : {}),
      ...(q
        ? {
            OR: [
              { province: { contains: q, mode: "insensitive" } },
              { licenseType: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      prisma.tuitionPlan.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.tuitionPlan.count({ where }),
    ]);

    return NextResponse.json({
      items: items.map((item) => ({
        ...item,
        totalAmount: item.tuition,
        paid50Amount: Math.floor(item.tuition * 0.5),
        note: null,
      })),
      page,
      pageSize,
      total,
    });
  } catch (error) {
    if (error instanceof Error && (error.message === "INVALID_PAGINATION" || error.message === "INVALID_BOOLEAN")) {
      return jsonError(400, "VALIDATION_ERROR", "Invalid query params");
    }
    return jsonError(500, "INTERNAL_ERROR", "Internal server error");
  }
}

export async function POST(req: Request) {
  const authResult = requireRouteAuth(req);
  if (authResult.error) return authResult.error;
  const adminError = requireAdminRole(authResult.auth.role);
  if (adminError) return adminError;

  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return jsonError(400, "VALIDATION_ERROR", "Invalid JSON body");
    }
    if (!body.province || typeof body.province !== "string") {
      return jsonError(400, "VALIDATION_ERROR", "province is required");
    }
    const licenseType = normalizeLicenseType(body.licenseType);
    if (!licenseType) {
      return jsonError(400, "VALIDATION_ERROR", "Invalid licenseType");
    }

    const totalAmount = parseAmount(body.totalAmount);
    if (body.paid50Amount !== undefined) {
      parseAmount(body.paid50Amount);
    }

    const plan = await prisma.tuitionPlan.create({
      data: {
        province: body.province.trim(),
        licenseType,
        tuition: totalAmount,
        isActive: typeof body.isActive === "boolean" ? body.isActive : true,
      },
    });

    return NextResponse.json({
      tuitionPlan: {
        ...plan,
        totalAmount: plan.tuition,
        paid50Amount: Math.floor(plan.tuition * 0.5),
        note: typeof body.note === "string" ? body.note : null,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === "INVALID_AMOUNT") {
      return jsonError(400, "VALIDATION_ERROR", "Invalid amount");
    }
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return jsonError(400, "VALIDATION_ERROR", "Tuition plan already exists");
    }
    return jsonError(500, "INTERNAL_ERROR", "Internal server error");
  }
}
