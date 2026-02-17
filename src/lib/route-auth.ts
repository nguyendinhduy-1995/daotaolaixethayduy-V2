import type { NextResponse } from "next/server";
import { AuthError, requireAuth, type AuthPayload } from "@/lib/auth";
import { jsonError } from "@/lib/api-response";
import { API_ERROR_VI } from "@/lib/api-error-vi";
import { getEffectivePermissions, requirePermission, type PermissionSet } from "@/lib/permissions";
import { resolveRoutePermission } from "@/lib/route-permissions-map";
import type { ActionKey, ModuleKey } from "@/lib/permission-keys";

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
      error: jsonError(401, "AUTH_MISSING_BEARER", "Thiếu hoặc sai token xác thực"),
    };
  }
}

type PermissionAuthResult =
  | { auth: AuthPayload; permissions: PermissionSet; error?: never }
  | { auth?: never; permissions?: never; error: NextResponse };

export async function requirePermissionRouteAuth(
  req: Request,
  input: { module: ModuleKey; action: ActionKey }
): Promise<PermissionAuthResult> {
  const authResult = requireRouteAuth(req);
  if (authResult.error) return { error: authResult.error };

  try {
    const permissions = await getEffectivePermissions(authResult.auth);
    const permissionError = requirePermission({
      user: authResult.auth,
      module: input.module,
      action: input.action,
      permissions,
    });
    if (permissionError) return { error: permissionError };
    return { auth: authResult.auth, permissions };
  } catch {
    return { error: jsonError(500, "INTERNAL_ERROR", API_ERROR_VI.internal) };
  }
}

export async function requireMappedRoutePermissionAuth(req: Request): Promise<PermissionAuthResult> {
  const pathname = new URL(req.url).pathname;
  const rule = resolveRoutePermission(pathname, req.method);
  if (!rule) {
    return { error: jsonError(403, "AUTH_FORBIDDEN", API_ERROR_VI.forbidden) };
  }
  return requirePermissionRouteAuth(req, { module: rule.module, action: rule.action });
}
