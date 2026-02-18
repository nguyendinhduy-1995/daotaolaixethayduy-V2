import jwt from "jsonwebtoken";
import type { AuthPayload } from "@/lib/auth";

export const ACCESS_TOKEN_COOKIE = "access_token";
export const REFRESH_TOKEN_COOKIE = "refresh_token";
export const STUDENT_ACCESS_TOKEN_COOKIE = "student_access_token";

const ACCESS_TOKEN_TTL = "1h";
const REFRESH_TOKEN_TTL = "30d";

/** Fail-fast with clear error instead of opaque undefined crash */
function getSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is not set — check .env");
  return secret;
}

type RefreshPayload = AuthPayload & { type: "refresh" };

export function signAccessToken(payload: AuthPayload) {
  return jwt.sign(payload, getSecret(), { expiresIn: ACCESS_TOKEN_TTL });
}

export function signRefreshToken(payload: AuthPayload) {
  return jwt.sign({ ...payload, type: "refresh" }, getSecret(), {
    expiresIn: REFRESH_TOKEN_TTL,
  });
}

export function verifyAccessToken(token: string) {
  return jwt.verify(token, getSecret()) as AuthPayload;
}

export function verifyRefreshToken(token: string) {
  return jwt.verify(token, getSecret()) as RefreshPayload;
}

type StudentPayload = { sub: string; role: "student"; phone: string; studentId: string };

export function signStudentAccessToken(payload: StudentPayload) {
  return jwt.sign(payload, getSecret(), { expiresIn: ACCESS_TOKEN_TTL });
}

export function verifyStudentAccessToken(token: string) {
  return jwt.verify(token, getSecret()) as StudentPayload;
}

