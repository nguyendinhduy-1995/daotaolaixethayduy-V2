import { NextResponse } from "next/server";
import type { Prisma, StudentContentCategory } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { jsonError } from "@/lib/api-response";
import { requireRouteAuth } from "@/lib/route-auth";
import { requireAdminRole } from "@/lib/admin-auth";
import { ensureStudentPortalSchema } from "@/lib/student-portal-db";

const CATEGORIES: StudentContentCategory[] = ["HUONG_DAN", "MEO_HOC", "HO_SO", "THI"];

function isCategory(value: unknown): value is StudentContentCategory {
  return typeof value === "string" && CATEGORIES.includes(value as StudentContentCategory);
}

function parsePositiveInt(value: string | null, fallback: number, max = 100) {
  if (value === null) return fallback;
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) throw new Error("INVALID_PAGINATION");
  return Math.min(n, max);
}

export async function GET(req: Request) {
  const authResult = requireRouteAuth(req);
  if (authResult.error) return authResult.error;
  const adminError = requireAdminRole(authResult.auth.role);
  if (adminError) return adminError;

  try {
    await ensureStudentPortalSchema();
    const { searchParams } = new URL(req.url);
    const page = parsePositiveInt(searchParams.get("page"), 1);
    const pageSize = parsePositiveInt(searchParams.get("pageSize"), 20);
    const category = searchParams.get("category");
    const q = searchParams.get("q")?.trim();
    const isPublished = searchParams.get("isPublished");

    if (category !== null && !isCategory(category)) {
      return jsonError(400, "VALIDATION_ERROR", "Invalid category");
    }
    if (isPublished !== null && isPublished !== "true" && isPublished !== "false") {
      return jsonError(400, "VALIDATION_ERROR", "Invalid isPublished");
    }

    const where: Prisma.StudentContentWhereInput = {
      ...(category ? { category } : {}),
      ...(isPublished !== null ? { isPublished: isPublished === "true" } : {}),
      ...(q
        ? {
            OR: [{ title: { contains: q, mode: "insensitive" } }, { body: { contains: q, mode: "insensitive" } }],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      prisma.studentContent.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.studentContent.count({ where }),
    ]);

    return NextResponse.json({ items, page, pageSize, total });
  } catch (error) {
    if (error instanceof Error && error.message === "INVALID_PAGINATION") {
      return jsonError(400, "VALIDATION_ERROR", "Invalid pagination");
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
    await ensureStudentPortalSchema();
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return jsonError(400, "VALIDATION_ERROR", "Invalid JSON body");
    }
    if (!isCategory(body.category)) {
      return jsonError(400, "VALIDATION_ERROR", "Invalid category");
    }
    if (!body.title || typeof body.title !== "string") {
      return jsonError(400, "VALIDATION_ERROR", "title is required");
    }
    if (!body.body || typeof body.body !== "string") {
      return jsonError(400, "VALIDATION_ERROR", "body is required");
    }

    const item = await prisma.studentContent.create({
      data: {
        category: body.category,
        title: body.title.trim(),
        body: body.body,
        isPublished: typeof body.isPublished === "boolean" ? body.isPublished : false,
      },
    });

    return NextResponse.json({ item });
  } catch {
    return jsonError(500, "INTERNAL_ERROR", "Internal server error");
  }
}
