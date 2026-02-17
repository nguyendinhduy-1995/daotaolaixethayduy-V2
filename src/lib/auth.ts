import { ACCESS_TOKEN_COOKIE, verifyAccessToken } from "@/lib/jwt";

export type AuthPayload = { sub: string; role: string; email: string };

export class AuthError extends Error {
  constructor(
    public readonly code: "AUTH_MISSING_BEARER" | "AUTH_INVALID_TOKEN",
    message: string,
    public readonly status = 401
  ) {
    super(message);
  }
}

function parseCookie(header: string, name: string) {
  const parts = header.split(";");
  for (const part of parts) {
    const [k, ...rest] = part.trim().split("=");
    if (k === name) return decodeURIComponent(rest.join("="));
  }
  return "";
}

function getTokenFromRequest(req: Request) {
  const header = req.headers.get("authorization")?.trim() ?? "";
  const parts = header.split(/\s+/);

  if (parts.length === 2 && parts[0].toLowerCase() === "bearer" && parts[1]) {
    return parts[1];
  }

  const cookieHeader = req.headers.get("cookie") ?? "";
  return parseCookie(cookieHeader, ACCESS_TOKEN_COOKIE);
}

export function requireAuth(req: Request): AuthPayload {
  const token = getTokenFromRequest(req);
  if (!token) {
    throw new AuthError("AUTH_MISSING_BEARER", "Thiếu hoặc sai token xác thực");
  }

  try {
    return verifyAccessToken(token);
  } catch {
    throw new AuthError("AUTH_INVALID_TOKEN", "Token không hợp lệ hoặc đã hết hạn");
  }
}
