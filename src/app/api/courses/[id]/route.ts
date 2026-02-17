import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError } from "@/lib/api-response";
import { requireMappedRoutePermissionAuth } from "@/lib/route-auth";

type RouteContext = { params: Promise<{ id: string }> | { id: string } };

function parseDate(value: unknown) {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  if (typeof value !== "string") throw new Error("INVALID_DATE");
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) throw new Error("INVALID_DATE");
  return d;
}

export async function GET(req: Request, context: RouteContext) {
  const authResult = await requireMappedRoutePermissionAuth(req);
  if (authResult.error) return authResult.error;

  try {
    const { id } = await Promise.resolve(context.params);
    const course = await prisma.course.findUnique({
      where: { id },
      include: { scheduleItems: { orderBy: { startAt: "asc" } } },
    });
    if (!course) return jsonError(404, "NOT_FOUND", "Course not found");
    return NextResponse.json({ course });
  } catch (err) {
    console.error("[courses.[id]]", err);
    return jsonError(500, "INTERNAL_ERROR", "Internal server error");
  }
}

export async function PATCH(req: Request, context: RouteContext) {
  const authResult = await requireMappedRoutePermissionAuth(req);
  if (authResult.error) return authResult.error;

  try {
    const { id } = await Promise.resolve(context.params);
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return jsonError(400, "VALIDATION_ERROR", "Invalid JSON body");
    }

    const exists = await prisma.course.findUnique({ where: { id }, select: { id: true } });
    if (!exists) return jsonError(404, "NOT_FOUND", "Course not found");

    const course = await prisma.course.update({
      where: { id },
      data: {
        ...(body.code !== undefined ? { code: typeof body.code === "string" ? body.code : undefined } : {}),
        ...(body.province !== undefined
          ? { province: typeof body.province === "string" ? body.province : null }
          : {}),
        ...(body.licenseType !== undefined
          ? { licenseType: typeof body.licenseType === "string" ? body.licenseType : null }
          : {}),
        ...(body.startDate !== undefined ? { startDate: parseDate(body.startDate) } : {}),
        ...(body.examDate !== undefined ? { examDate: parseDate(body.examDate) } : {}),
        ...(body.description !== undefined
          ? { description: typeof body.description === "string" ? body.description : null }
          : {}),
        ...(body.isActive !== undefined
          ? { isActive: typeof body.isActive === "boolean" ? body.isActive : undefined }
          : {}),
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
