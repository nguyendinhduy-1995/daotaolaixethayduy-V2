import { NextResponse } from "next/server";
import bcrypt from "bcrypt";
import type { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { jsonError } from "@/lib/api-response";
import { API_ERROR_VI } from "@/lib/api-error-vi";
import { requirePermissionRouteAuth } from "@/lib/route-auth";

type RouteContext = { params: Promise<{ id: string }> | { id: string } };

const ROLES: Role[] = ["admin", "manager", "telesales", "direct_page", "viewer"];

function isRole(value: unknown): value is Role {
  return typeof value === "string" && ROLES.includes(value as Role);
}

export async function GET(req: Request, context: RouteContext) {
  const authResult = await requirePermissionRouteAuth(req, { module: "admin_users", action: "VIEW" });
  if (authResult.error) return authResult.error;

  try {
    const { id } = await Promise.resolve(context.params);
    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        username: true,
        role: true,
        isActive: true,
        branchId: true,
        branch: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        createdAt: true,
        updatedAt: true,
      },
    });
    if (!user) return jsonError(404, "NOT_FOUND", "Không tìm thấy người dùng");
    return NextResponse.json({ user });
  } catch (err) {
    console.error("[users.[id]]", err);
    return jsonError(500, "INTERNAL_ERROR", API_ERROR_VI.internal);
  }
}

export async function PATCH(req: Request, context: RouteContext) {
  const authResult = await requirePermissionRouteAuth(req, { module: "admin_users", action: "UPDATE" });
  if (authResult.error) return authResult.error;

  try {
    const { id } = await Promise.resolve(context.params);
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return jsonError(400, "VALIDATION_ERROR", API_ERROR_VI.required);
    }

    if (body.role !== undefined && !isRole(body.role)) {
      return jsonError(400, "VALIDATION_ERROR", API_ERROR_VI.required);
    }
    if (body.branchId !== undefined && body.branchId !== null && typeof body.branchId !== "string") {
      return jsonError(400, "VALIDATION_ERROR", API_ERROR_VI.required);
    }
    if (body.password !== undefined && (typeof body.password !== "string" || body.password.length < 8)) {
      return jsonError(400, "VALIDATION_ERROR", API_ERROR_VI.required);
    }

    const branchId =
      typeof body.branchId === "string" && body.branchId.trim().length > 0 ? body.branchId.trim() : null;
    if (body.branchId !== undefined && branchId) {
      const branch = await prisma.branch.findUnique({ where: { id: branchId }, select: { id: true } });
      if (!branch) return jsonError(400, "VALIDATION_ERROR", API_ERROR_VI.required);
    }

    const exists = await prisma.user.findUnique({ where: { id }, select: { id: true } });
    if (!exists) return jsonError(404, "NOT_FOUND", "Không tìm thấy người dùng");

    const passwordHash =
      typeof body.password === "string" && body.password.length >= 8
        ? await bcrypt.hash(body.password, 10)
        : undefined;

    const user = await prisma.user.update({
      where: { id },
      data: {
        ...(body.name !== undefined ? { name: typeof body.name === "string" ? body.name : null } : {}),
        ...(body.role !== undefined ? { role: body.role } : {}),
        ...(body.isActive !== undefined
          ? { isActive: typeof body.isActive === "boolean" ? body.isActive : undefined }
          : {}),
        ...(body.branchId !== undefined ? { branchId } : {}),
        ...(passwordHash ? { password: passwordHash } : {}),
      },
      select: {
        id: true,
        name: true,
        email: true,
        username: true,
        role: true,
        isActive: true,
        branchId: true,
        branch: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({ user });
  } catch (err) {
    console.error("[users.[id]]", err);
    return jsonError(500, "INTERNAL_ERROR", API_ERROR_VI.internal);
  }
}
