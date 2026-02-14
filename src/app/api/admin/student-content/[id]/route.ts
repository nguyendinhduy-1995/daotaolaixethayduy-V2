import { NextResponse } from "next/server";
import type { StudentContentCategory } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { jsonError } from "@/lib/api-response";
import { requireRouteAuth } from "@/lib/route-auth";
import { requireAdminRole } from "@/lib/admin-auth";
import { ensureStudentPortalSchema } from "@/lib/student-portal-db";

type RouteContext = { params: Promise<{ id: string }> | { id: string } };

const CATEGORIES: StudentContentCategory[] = ["HUONG_DAN", "MEO_HOC", "HO_SO", "THI"];
function isCategory(value: unknown): value is StudentContentCategory {
  return typeof value === "string" && CATEGORIES.includes(value as StudentContentCategory);
}

export async function PATCH(req: Request, context: RouteContext) {
  const authResult = requireRouteAuth(req);
  if (authResult.error) return authResult.error;
  const adminError = requireAdminRole(authResult.auth.role);
  if (adminError) return adminError;

  try {
    await ensureStudentPortalSchema();
    const { id } = await Promise.resolve(context.params);
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return jsonError(400, "VALIDATION_ERROR", "Invalid JSON body");
    }

    if (body.category !== undefined && !isCategory(body.category)) {
      return jsonError(400, "VALIDATION_ERROR", "Invalid category");
    }

    const item = await prisma.studentContent.update({
      where: { id },
      data: {
        ...(body.category !== undefined ? { category: body.category } : {}),
        ...(body.title !== undefined ? { title: String(body.title || "") } : {}),
        ...(body.body !== undefined ? { body: String(body.body || "") } : {}),
        ...(body.isPublished !== undefined ? { isPublished: Boolean(body.isPublished) } : {}),
      },
    });
    return NextResponse.json({ item });
  } catch {
    return jsonError(500, "INTERNAL_ERROR", "Internal server error");
  }
}
