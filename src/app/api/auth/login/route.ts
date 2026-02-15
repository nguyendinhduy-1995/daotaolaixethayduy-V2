import { NextResponse } from "next/server";
import bcrypt from "bcrypt";
import { prisma } from "@/lib/prisma";
import { jsonError } from "@/lib/api-response";
import { setAuthCookies } from "@/lib/auth-cookies";
import { signAccessToken, signRefreshToken } from "@/lib/jwt";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    if (!body?.email || !body?.password) {
      return jsonError(400, "VALIDATION_ERROR", "Missing email/password");
    }

    const user = await prisma.user.findUnique({ where: { email: body.email } });
    if (!user || !user.isActive) {
      return jsonError(401, "AUTH_UNAUTHORIZED", "Invalid credentials");
    }

    const ok = await bcrypt.compare(body.password, user.password);
    if (!ok) return jsonError(401, "AUTH_UNAUTHORIZED", "Invalid credentials");

    const payload = { sub: user.id, role: user.role, email: user.email };
    const accessToken = signAccessToken(payload);
    const refreshToken = signRefreshToken(payload);

    const response = NextResponse.json({
      token: accessToken,
      accessToken,
      tokenType: "Bearer",
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
    });
    setAuthCookies(response, accessToken, refreshToken);
    return response;
  } catch {
    return jsonError(500, "INTERNAL_ERROR", "Internal server error");
  }
}
