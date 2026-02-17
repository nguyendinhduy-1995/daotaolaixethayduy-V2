import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-response";
import { requireAdminRole } from "@/lib/admin-auth";
import {
  EmployeeKpiValidationError,
  updateSetting,
} from "@/lib/services/employee-kpi";
import { requireMappedRoutePermissionAuth } from "@/lib/route-auth";

type RouteContext = { params: Promise<{ id: string }> | { id: string } };

export async function PATCH(req: Request, context: RouteContext) {
  const authResult = await requireMappedRoutePermissionAuth(req);
  if (authResult.error) return authResult.error;
  const adminError = requireAdminRole(authResult.auth.role);
  if (adminError) return adminError;

  try {
    const { id } = await Promise.resolve(context.params);
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return jsonError(400, "VALIDATION_ERROR", "Invalid JSON body");
    }

    if (body.role !== undefined && body.role !== "PAGE" && body.role !== "TELESALES") {
      return jsonError(400, "VALIDATION_ERROR", "role must be PAGE or TELESALES");
    }

    const setting = await updateSetting(id, {
      role: body.role,
      effectiveFrom: body.effectiveFrom,
      effectiveTo: body.effectiveTo,
      targetsJson: body.targetsJson,
      isActive: typeof body.isActive === "boolean" ? body.isActive : undefined,
    });

    return NextResponse.json({ setting });
  } catch (error) {
    if (error instanceof EmployeeKpiValidationError) {
      const isNotFound = error.message === "Setting not found";
      return jsonError(isNotFound ? 404 : 400, isNotFound ? "NOT_FOUND" : "VALIDATION_ERROR", error.message);
    }
    return jsonError(500, "INTERNAL_ERROR", "Internal server error");
  }
}
