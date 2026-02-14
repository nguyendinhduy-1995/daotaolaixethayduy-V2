import { STUDENT_ACCESS_TOKEN_COOKIE, verifyStudentAccessToken } from "@/lib/jwt";

export type StudentAuthPayload = { sub: string; role: "student"; phone: string; studentId: string };

export class StudentAuthError extends Error {
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

export function requireStudentAuth(req: Request): StudentAuthPayload {
  const cookieHeader = req.headers.get("cookie") ?? "";
  const token = parseCookie(cookieHeader, STUDENT_ACCESS_TOKEN_COOKIE);
  if (!token) throw new StudentAuthError("AUTH_MISSING_BEARER", "Unauthorized");
  try {
    return verifyStudentAccessToken(token);
  } catch {
    throw new StudentAuthError("AUTH_INVALID_TOKEN", "Unauthorized");
  }
}
