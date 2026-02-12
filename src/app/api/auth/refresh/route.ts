import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { prisma } from "@/lib/prisma";
import { AuthError, requireAuth } from "@/lib/auth";
import { jsonError } from "@/lib/api-response";

export async function POST(req: Request) {
  let auth;
  try {
    auth = requireAuth(req);
  } catch (error) {
    if (error instanceof AuthError) {
      return jsonError(error.status, error.code, error.message);
    }
    return jsonError(401, "UNAUTHORIZED", "Unauthorized");
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: auth.sub },
      select: { id: true, email: true, name: true, role: true, isActive: true },
    });

    if (!user || !user.isActive) {
      return jsonError(401, "UNAUTHORIZED", "Unauthorized");
    }

    const accessToken = jwt.sign(
      { sub: user.id, role: user.role, email: user.email },
      process.env.JWT_SECRET!,
      { expiresIn: "7d" }
    );

    return NextResponse.json({
      token: accessToken,
      accessToken,
      tokenType: "Bearer",
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
    });
  } catch {
    return jsonError(500, "INTERNAL_ERROR", "Internal server error");
  }
}
