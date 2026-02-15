import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { AuthError, requireAuth } from "@/lib/auth";
import { jsonError } from "@/lib/api-response";

export async function GET(req: Request) {
  let auth;
  try {
    auth = requireAuth(req);
  } catch (error) {
    if (error instanceof AuthError) {
      return jsonError(error.status, error.code, error.message);
    }
    return jsonError(401, "AUTH_INVALID_TOKEN", "Invalid or expired token");
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: auth.sub },
      select: { id: true, email: true, name: true, role: true, isActive: true },
    });

    if (!user || !user.isActive) {
      return jsonError(401, "AUTH_INVALID_TOKEN", "Invalid or expired token");
    }

    return NextResponse.json({
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
    });
  } catch {
    return jsonError(500, "INTERNAL_ERROR", "Internal server error");
  }
}
