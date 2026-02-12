import { NextResponse } from "next/server";
import bcrypt from "bcrypt";
import type { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { jsonError } from "@/lib/api-response";
import { requireRouteAuth } from "@/lib/route-auth";
import { requireAdminRole } from "@/lib/admin-auth";

type RouteContext = { params: Promise<{ id: string }> | { id: string } };

const ROLES: Role[] = ["admin", "manager", "telesales", "direct_page", "viewer"];

function isRole(value: unknown): value is Role {
  return typeof value === "string" && ROLES.includes(value as Role);
}

export async function GET(req: Request, context: RouteContext) {
  const authResult = requireRouteAuth(req);
  if (authResult.error) return authResult.error;
  const adminError = requireAdminRole(authResult.auth.role);
  if (adminError) return adminError;

  try {
    const { id } = await Promise.resolve(context.params);
    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    if (!user) return jsonError(404, "NOT_FOUND", "User not found");
    return NextResponse.json({ user });
  } catch {
    return jsonError(500, "INTERNAL_ERROR", "Internal server error");
  }
}

export async function PATCH(req: Request, context: RouteContext) {
  const authResult = requireRouteAuth(req);
  if (authResult.error) return authResult.error;
  const adminError = requireAdminRole(authResult.auth.role);
  if (adminError) return adminError;

  try {
    const { id } = await Promise.resolve(context.params);
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return jsonError(400, "VALIDATION_ERROR", "Invalid JSON body");
    }

    if (body.role !== undefined && !isRole(body.role)) {
      return jsonError(400, "VALIDATION_ERROR", "Invalid role");
    }
    if (body.password !== undefined && (typeof body.password !== "string" || body.password.length < 8)) {
      return jsonError(400, "VALIDATION_ERROR", "password must be at least 8 characters");
    }

    const exists = await prisma.user.findUnique({ where: { id }, select: { id: true } });
    if (!exists) return jsonError(404, "NOT_FOUND", "User not found");

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
        ...(passwordHash ? { password: passwordHash } : {}),
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({ user });
  } catch {
    return jsonError(500, "INTERNAL_ERROR", "Internal server error");
  }
}
