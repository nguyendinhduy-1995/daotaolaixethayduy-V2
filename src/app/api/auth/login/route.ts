import { NextResponse } from "next/server";
import bcrypt from "bcrypt";
import { prisma } from "@/lib/prisma";
import { jsonError } from "@/lib/api-response";
import { setAuthCookies } from "@/lib/auth-cookies";
import { signAccessToken, signRefreshToken } from "@/lib/jwt";
import { checkRateLimit } from "@/lib/rate-limit";

export async function POST(req: Request) {
  const rateLimited = checkRateLimit(req, { name: "admin-login", maxRequests: 10, windowSec: 60 });
  if (rateLimited) return rateLimited;

  try {
    const body = await req.json().catch(() => null);
    const account = String(body?.account ?? body?.email ?? "").trim();
    const password = String(body?.password ?? "");
    if (!account || !password) {
      return jsonError(400, "VALIDATION_ERROR", "Thiếu tài khoản hoặc mật khẩu");
    }

    const user = await prisma.user.findFirst({
      where: {
        OR: [{ email: account }, { username: account }],
      },
    });
    if (!user || !user.isActive) {
      return jsonError(401, "AUTH_UNAUTHORIZED", "Thông tin đăng nhập không chính xác");
    }

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return jsonError(401, "AUTH_UNAUTHORIZED", "Thông tin đăng nhập không chính xác");

    const payload = { sub: user.id, role: user.role, email: user.email };
    const accessToken = signAccessToken(payload);
    const refreshToken = signRefreshToken(payload);

    const response = NextResponse.json({
      token: accessToken,
      accessToken,
      tokenType: "Bearer",
      user: { id: user.id, email: user.email, username: user.username, name: user.name, role: user.role },
    });
    setAuthCookies(response, accessToken, refreshToken);
    return response;
  } catch (err) {
    console.error("[auth.login]", err);
    return jsonError(500, "INTERNAL_ERROR", "Lỗi hệ thống");
  }
}
