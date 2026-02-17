import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError } from "@/lib/api-response";
import { requireMappedRoutePermissionAuth } from "@/lib/route-auth";
import { requireAdminRole } from "@/lib/admin-auth";

type RouteContext = { params: Promise<{ id: string }> | { id: string } };

function normalizeLicenseType(value: unknown) {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim().toUpperCase();
  if (!normalized) return undefined;
  if (normalized.length > 16) return undefined;
  return normalized;
}

function parseAmount(value: unknown) {
  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
    throw new Error("INVALID_AMOUNT");
  }
  return value;
}

export async function GET(req: Request, context: RouteContext) {
  const authResult = await requireMappedRoutePermissionAuth(req);
  if (authResult.error) return authResult.error;
  const adminError = requireAdminRole(authResult.auth.role);
  if (adminError) return adminError;

  try {
    const { id } = await Promise.resolve(context.params);
    const tuitionPlan = await prisma.tuitionPlan.findUnique({ where: { id } });
    if (!tuitionPlan) return jsonError(404, "NOT_FOUND", "Tuition plan not found");
    return NextResponse.json({
      tuitionPlan: {
        ...tuitionPlan,
        totalAmount: tuitionPlan.tuition,
        paid50Amount: Math.floor(tuitionPlan.tuition * 0.5),
        note: null,
      },
    });
  } catch (err) {
    console.error("[tuition-plans.[id]]", err);
    return jsonError(500, "INTERNAL_ERROR", "Internal server error");
  }
}

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
    const licenseType =
      body.licenseType !== undefined ? normalizeLicenseType(body.licenseType) : undefined;
    if (body.licenseType !== undefined && !licenseType) return jsonError(400, "VALIDATION_ERROR", "Invalid licenseType");
    if (body.province !== undefined && (typeof body.province !== "string" || !body.province.trim())) {
      return jsonError(400, "VALIDATION_ERROR", "Invalid province");
    }

    const current = await prisma.tuitionPlan.findUnique({ where: { id }, select: { id: true } });
    if (!current) return jsonError(404, "NOT_FOUND", "Tuition plan not found");

    const totalAmount = body.totalAmount !== undefined ? parseAmount(body.totalAmount) : undefined;
    if (body.paid50Amount !== undefined) {
      parseAmount(body.paid50Amount);
    }

    const tuitionPlan = await prisma.tuitionPlan.update({
      where: { id },
      data: {
        ...(body.province !== undefined ? { province: body.province.trim() } : {}),
        ...(licenseType !== undefined ? { licenseType } : {}),
        ...(totalAmount !== undefined ? { tuition: totalAmount } : {}),
        ...(body.isActive !== undefined
          ? { isActive: typeof body.isActive === "boolean" ? body.isActive : undefined }
          : {}),
      },
    });

    return NextResponse.json({
      tuitionPlan: {
        ...tuitionPlan,
        totalAmount: tuitionPlan.tuition,
        paid50Amount: Math.floor(tuitionPlan.tuition * 0.5),
        note: typeof body.note === "string" ? body.note : null,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === "INVALID_AMOUNT") {
      return jsonError(400, "VALIDATION_ERROR", "Invalid amount");
    }
    return jsonError(500, "INTERNAL_ERROR", "Internal server error");
  }
}
