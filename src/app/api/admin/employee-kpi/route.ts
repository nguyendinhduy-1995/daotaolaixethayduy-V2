import type { EmployeeKpiRole } from "@prisma/client";
import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-response";
import { requireAdminRole } from "@/lib/admin-auth";
import {
  createSetting,
  EmployeeKpiValidationError,
  listSettings,
} from "@/lib/services/employee-kpi";
import { requireMappedRoutePermissionAuth } from "@/lib/route-auth";

function parseBooleanFilter(value: string | null) {
  if (value === null) return undefined;
  if (value === "true") return true;
  if (value === "false") return false;
  throw new Error("INVALID_BOOLEAN");
}

function parsePositiveInt(value: string | null, fallback: number, max = 100) {
  if (value === null) return fallback;
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) throw new Error("INVALID_PAGINATION");
  return Math.min(n, max);
}

function parseRole(role: string | null) {
  if (!role) return undefined;
  if (role === "PAGE" || role === "TELESALES") return role as EmployeeKpiRole;
  throw new Error("INVALID_ROLE");
}

export async function GET(req: Request) {
  const authResult = await requireMappedRoutePermissionAuth(req);
  if (authResult.error) return authResult.error;
  const adminError = requireAdminRole(authResult.auth.role);
  if (adminError) return adminError;

  try {
    const { searchParams } = new URL(req.url);
    const page = parsePositiveInt(searchParams.get("page"), 1);
    const pageSize = parsePositiveInt(searchParams.get("pageSize"), 20);
    const role = parseRole(searchParams.get("role"));
    const active = parseBooleanFilter(searchParams.get("active"));
    const userId = searchParams.get("userId")?.trim() || undefined;

    const data = await listSettings({ page, pageSize, role, active, userId });
    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof Error) {
      if (["INVALID_BOOLEAN", "INVALID_PAGINATION", "INVALID_ROLE"].includes(error.message)) {
        return jsonError(400, "VALIDATION_ERROR", "Invalid query params");
      }
    }
    return jsonError(500, "INTERNAL_ERROR", "Internal server error");
  }
}

export async function POST(req: Request) {
  const authResult = await requireMappedRoutePermissionAuth(req);
  if (authResult.error) return authResult.error;
  const adminError = requireAdminRole(authResult.auth.role);
  if (adminError) return adminError;

  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return jsonError(400, "VALIDATION_ERROR", "Invalid JSON body");
    }

    if (typeof body.userId !== "string" || !body.userId.trim()) {
      return jsonError(400, "VALIDATION_ERROR", "userId is required");
    }
    if (body.role !== "PAGE" && body.role !== "TELESALES") {
      return jsonError(400, "VALIDATION_ERROR", "role must be PAGE or TELESALES");
    }

    const setting = await createSetting({
      userId: body.userId.trim(),
      role: body.role,
      effectiveFrom: body.effectiveFrom,
      effectiveTo: body.effectiveTo,
      targetsJson: body.targetsJson,
      isActive: typeof body.isActive === "boolean" ? body.isActive : true,
    });

    return NextResponse.json({ setting });
  } catch (error) {
    if (error instanceof EmployeeKpiValidationError) {
      return jsonError(400, "VALIDATION_ERROR", error.message);
    }
    return jsonError(500, "INTERNAL_ERROR", "Internal server error");
  }
}
