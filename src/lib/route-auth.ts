import type { NextResponse } from "next/server";
import { AuthError, requireAuth, type AuthPayload } from "@/lib/auth";
import { jsonError } from "@/lib/api-response";

type AuthResult =
  | { auth: AuthPayload; error?: never }
  | { auth?: never; error: NextResponse };

export function requireRouteAuth(req: Request): AuthResult {
  try {
    return { auth: requireAuth(req) };
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: jsonError(error.status, error.code, error.message) };
    }
    return {
      error: jsonError(401, "AUTH_MISSING_BEARER", "Missing or invalid Authorization Bearer token"),
    };
  }
}
