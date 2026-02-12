import jwt from "jsonwebtoken";

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

export function requireAuth(req: Request): AuthPayload {
  const header = req.headers.get("authorization")?.trim() ?? "";
  const parts = header.split(/\s+/);

  if (parts.length !== 2 || parts[0].toLowerCase() !== "bearer" || !parts[1]) {
    throw new AuthError("AUTH_MISSING_BEARER", "Missing or invalid Authorization Bearer token");
  }

  try {
    return jwt.verify(parts[1], process.env.JWT_SECRET!) as AuthPayload;
  } catch {
    throw new AuthError("AUTH_INVALID_TOKEN", "Invalid or expired token");
  }
}
