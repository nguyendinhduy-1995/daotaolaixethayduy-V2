import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { AuthError, requireAuth } from "@/lib/auth";
import { jsonError } from "@/lib/api-response";
import { API_ERROR_VI } from "@/lib/api-error-vi";
import { getEffectivePermissions, serializePermissions } from "@/lib/permissions";

export async function GET(req: Request) {
  let auth;
  try {
    auth = requireAuth(req);
  } catch (error) {
    if (error instanceof AuthError) {
      return jsonError(error.status, error.code, error.message);
    }
    return jsonError(401, "AUTH_UNAUTHENTICATED", API_ERROR_VI.unauthenticated);
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: auth.sub },
      select: { id: true, email: true, username: true, name: true, role: true, isActive: true },
    });

    if (!user || !user.isActive) {
      return jsonError(401, "AUTH_INVALID_TOKEN", API_ERROR_VI.invalidToken);
    }

    const permissions = await getEffectivePermissions({ sub: user.id, role: user.role });

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        name: user.name,
        role: user.role,
        groupId: null,
        permissions: serializePermissions(permissions),
      },
    });
  } catch (err) {
    console.error("[auth.me]", err);
    return jsonError(500, "INTERNAL_ERROR", API_ERROR_VI.internal);
  }
}
