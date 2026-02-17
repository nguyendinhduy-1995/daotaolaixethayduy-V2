import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { jsonError } from "@/lib/api-response";
import { requireMappedRoutePermissionAuth } from "@/lib/route-auth";

function parsePositiveInt(value: string | null, fallback: number, max = 100) {
  if (value === null) return fallback;
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) throw new Error("INVALID_PAGINATION");
  return Math.min(n, max);
}

function parseDate(value: unknown) {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") throw new Error("INVALID_DATE");
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) throw new Error("INVALID_DATE");
  return d;
}

function parseBooleanParam(value: string | null) {
  if (value === null) return undefined;
  if (value === "true") return true;
  if (value === "false") return false;
  throw new Error("INVALID_BOOLEAN");
}

export async function GET(req: Request) {
  const authResult = await requireMappedRoutePermissionAuth(req);
  if (authResult.error) return authResult.error;

  try {
    const { searchParams } = new URL(req.url);
    const page = parsePositiveInt(searchParams.get("page"), 1);
    const pageSize = parsePositiveInt(searchParams.get("pageSize"), 20);
    const code = searchParams.get("code")?.trim();
    const province = searchParams.get("province")?.trim();
    const licenseType = searchParams.get("licenseType")?.trim();
    const isActive = parseBooleanParam(searchParams.get("isActive"));

    const where: Prisma.CourseWhereInput = {
      ...(code ? { code: { contains: code, mode: "insensitive" } } : {}),
      ...(province ? { province } : {}),
      ...(licenseType ? { licenseType } : {}),
      ...(isActive !== undefined ? { isActive } : {}),
    };

    const [items, total] = await Promise.all([
      prisma.course.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.course.count({ where }),
    ]);

    return NextResponse.json({ items, page, pageSize, total });
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message === "INVALID_PAGINATION" || error.message === "INVALID_BOOLEAN")
    ) {
      return jsonError(400, "VALIDATION_ERROR", "Invalid query params");
    }
    return jsonError(500, "INTERNAL_ERROR", "Internal server error");
  }
}

export async function POST(req: Request) {
  const authResult = await requireMappedRoutePermissionAuth(req);
  if (authResult.error) return authResult.error;

  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return jsonError(400, "VALIDATION_ERROR", "Invalid JSON body");
    }
    if (!body.code || typeof body.code !== "string") {
      return jsonError(400, "VALIDATION_ERROR", "code is required");
    }

    const course = await prisma.course.create({
      data: {
        code: body.code,
        province: typeof body.province === "string" ? body.province : null,
        licenseType: typeof body.licenseType === "string" ? body.licenseType : null,
        startDate: parseDate(body.startDate),
        examDate: parseDate(body.examDate),
        description: typeof body.description === "string" ? body.description : null,
        isActive: typeof body.isActive === "boolean" ? body.isActive : true,
      },
    });

    return NextResponse.json({ course });
  } catch (error) {
    if (error instanceof Error && error.message === "INVALID_DATE") {
      return jsonError(400, "VALIDATION_ERROR", "Invalid date");
    }
    return jsonError(500, "INTERNAL_ERROR", "Internal server error");
  }
}
