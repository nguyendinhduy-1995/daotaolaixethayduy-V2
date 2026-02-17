import { NextResponse } from "next/server";
import type { StudentContentCategory } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { jsonError } from "@/lib/api-response";
import { requireStudentAuth, StudentAuthError } from "@/lib/student-auth";
import { ensureStudentPortalSchema } from "@/lib/student-portal-db";

const CATEGORIES: StudentContentCategory[] = ["HUONG_DAN", "MEO_HOC", "HO_SO", "THI"];

function isCategory(value: string | null): value is StudentContentCategory {
  return value !== null && CATEGORIES.includes(value as StudentContentCategory);
}

export async function GET(req: Request) {
  try {
    requireStudentAuth(req);
  } catch (error) {
    if (error instanceof StudentAuthError) {
      return jsonError(error.status, error.code, error.message);
    }
    return jsonError(401, "AUTH_INVALID_TOKEN", "Unauthorized");
  }

  try {
    await ensureStudentPortalSchema();
    const { searchParams } = new URL(req.url);
    const category = searchParams.get("category");
    if (category !== null && !isCategory(category)) {
      return jsonError(400, "VALIDATION_ERROR", "Invalid category");
    }

    const items = await prisma.studentContent.findMany({
      where: {
        isPublished: true,
        ...(category ? { category } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    return NextResponse.json({ items });
  } catch (err) {
    console.error("[student.content]", err);
    return jsonError(500, "INTERNAL_ERROR", "Internal server error");
  }
}
