import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError } from "@/lib/api-response";
import { requireAdminRole } from "@/lib/admin-auth";
import { requireRouteAuth } from "@/lib/route-auth";

type RouteContext = { params: Promise<{ id: string }> | { id: string } };

export async function PATCH(req: Request, context: RouteContext) {
  const auth = requireRouteAuth(req);
  if (auth.error) return auth.error;
  const adminError = requireAdminRole(auth.auth.role);
  if (adminError) return adminError;

  try {
    const { id } = await Promise.resolve(context.params);
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return jsonError(400, "VALIDATION_ERROR", "Invalid JSON body");
    }

    const exists = await prisma.branch.findUnique({ where: { id }, select: { id: true } });
    if (!exists) return jsonError(404, "NOT_FOUND", "Branch not found");

    const code = body.code === undefined ? undefined : String(body.code || "").trim().toUpperCase();
    if (code !== undefined && code.length > 32) {
      return jsonError(400, "VALIDATION_ERROR", "code must be at most 32 characters");
    }

    const nextCommissionRaw =
      body.commissionPerPaid50 === null || body.commissionPerPaid50 === undefined
        ? null
        : Number(body.commissionPerPaid50);

    if (
      body.commissionPerPaid50 !== undefined &&
      body.commissionPerPaid50 !== null &&
      (!Number.isInteger(nextCommissionRaw) || (nextCommissionRaw as number) < 0)
    ) {
      return jsonError(400, "VALIDATION_ERROR", "commissionPerPaid50 must be a non-negative integer");
    }

    const nextCommission = nextCommissionRaw === null ? null : (nextCommissionRaw as number);

    const branch = await prisma.branch.update({
      where: { id },
      data: {
        ...(body.name !== undefined ? { name: String(body.name).trim() } : {}),
        ...(body.code !== undefined ? { code: code || null } : {}),
        ...(body.isActive !== undefined ? { isActive: Boolean(body.isActive) } : {}),
        ...(body.commissionPerPaid50 !== undefined ? { commissionPerPaid50: nextCommission } : {}),
      },
    });

    return NextResponse.json({ branch });
  } catch (error) {
    if ((error as { code?: string })?.code === "P2002") {
      return jsonError(400, "VALIDATION_ERROR", "Branch code already exists");
    }
    return jsonError(500, "INTERNAL_ERROR", "Internal server error");
  }
}
