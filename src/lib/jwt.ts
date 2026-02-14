import jwt from "jsonwebtoken";
import type { AuthPayload } from "@/lib/auth";

export const ACCESS_TOKEN_COOKIE = "access_token";
export const REFRESH_TOKEN_COOKIE = "refresh_token";
export const STUDENT_ACCESS_TOKEN_COOKIE = "student_access_token";

const ACCESS_TOKEN_TTL = "1h";
const REFRESH_TOKEN_TTL = "30d";

type RefreshPayload = AuthPayload & { type: "refresh" };

export function signAccessToken(payload: AuthPayload) {
  return jwt.sign(payload, process.env.JWT_SECRET!, { expiresIn: ACCESS_TOKEN_TTL });
}

export function signRefreshToken(payload: AuthPayload) {
  return jwt.sign({ ...payload, type: "refresh" }, process.env.JWT_SECRET!, {
    expiresIn: REFRESH_TOKEN_TTL,
  });
}

export function verifyAccessToken(token: string) {
  return jwt.verify(token, process.env.JWT_SECRET!) as AuthPayload;
}

export function verifyRefreshToken(token: string) {
  return jwt.verify(token, process.env.JWT_SECRET!) as RefreshPayload;
}

type StudentPayload = { sub: string; role: "student"; phone: string; studentId: string };

export function signStudentAccessToken(payload: StudentPayload) {
  return jwt.sign(payload, process.env.JWT_SECRET!, { expiresIn: ACCESS_TOKEN_TTL });
}

export function verifyStudentAccessToken(token: string) {
  return jwt.verify(token, process.env.JWT_SECRET!) as StudentPayload;
}
