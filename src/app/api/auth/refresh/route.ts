import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError } from "@/lib/api-response";
import { setAuthCookies } from "@/lib/auth-cookies";
import { REFRESH_TOKEN_COOKIE, signAccessToken, signRefreshToken, verifyRefreshToken } from "@/lib/jwt";

function parseCookie(header: string, name: string) {
  const parts = header.split(";");
  for (const part of parts) {
    const [k, ...rest] = part.trim().split("=");
    if (k === name) return decodeURIComponent(rest.join("="));
  }
  return "";
}

function getRefreshToken(req: Request, body: unknown) {
  const cookieHeader = req.headers.get("cookie") ?? "";
  const fromCookie = parseCookie(cookieHeader, REFRESH_TOKEN_COOKIE);
  if (fromCookie) return fromCookie;

  const fromBody = (body as { refreshToken?: string } | null)?.refreshToken;
  if (fromBody) return fromBody;

  const authHeader = req.headers.get("authorization")?.trim() ?? "";
  const parts = authHeader.split(/\s+/);
  if (parts.length === 2 && parts[0].toLowerCase() === "bearer" && parts[1]) {
    return parts[1];
  }

  return "";
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const refreshToken = getRefreshToken(req, body);
  if (!refreshToken) {
    return jsonError(401, "AUTH_MISSING_BEARER", "Missing or invalid Authorization Bearer token");
  }

  let payload;
  try {
    payload = verifyRefreshToken(refreshToken);
    if (payload.type !== "refresh") throw new Error("invalid");
  } catch {
    return jsonError(401, "AUTH_INVALID_TOKEN", "Invalid or expired token");
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, name: true, role: true, isActive: true },
    });

    if (!user || !user.isActive) {
      return jsonError(401, "UNAUTHORIZED", "Unauthorized");
    }

    const tokenPayload = { sub: user.id, role: user.role, email: user.email };
    const accessToken = signAccessToken(tokenPayload);
    const nextRefreshToken = signRefreshToken(tokenPayload);

    const response = NextResponse.json({
      token: accessToken,
      accessToken,
      tokenType: "Bearer",
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
    });
    setAuthCookies(response, accessToken, nextRefreshToken);
    return response;
  } catch {
    return jsonError(500, "INTERNAL_ERROR", "Internal server error");
  }
}
