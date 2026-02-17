import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError } from "@/lib/api-response";
import { requireMappedRoutePermissionAuth } from "@/lib/route-auth";
import { requireAdminRole } from "@/lib/admin-auth";

type RouteContext = { params: Promise<{ id: string }> | { id: string } };

export async function GET(req: Request, context: RouteContext) {
  const auth = await requireMappedRoutePermissionAuth(req);
  if (auth.error) return auth.error;
  const adminError = requireAdminRole(auth.auth.role);
  if (adminError) return adminError;

  try {
    const { id } = await Promise.resolve(context.params);
    const profile = await prisma.salaryProfile.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, name: true, email: true } },
        branch: { select: { id: true, name: true } },
        commissionScheme: { select: { id: true, name: true } },
      },
    });
    if (!profile) return jsonError(404, "NOT_FOUND", "Salary profile not found");
    return NextResponse.json({ profile });
  } catch {
    return jsonError(500, "INTERNAL_ERROR", "Internal server error");
  }
}

export async function PATCH(req: Request, context: RouteContext) {
  const auth = await requireMappedRoutePermissionAuth(req);
  if (auth.error) return auth.error;
  const adminError = requireAdminRole(auth.auth.role);
  if (adminError) return adminError;

  try {
    const { id } = await Promise.resolve(context.params);
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") return jsonError(400, "VALIDATION_ERROR", "Invalid JSON body");

    const exists = await prisma.salaryProfile.findUnique({ where: { id }, select: { id: true } });
    if (!exists) return jsonError(404, "NOT_FOUND", "Salary profile not found");

    const profile = await prisma.salaryProfile.update({
      where: { id },
      data: {
        ...(body.branchId !== undefined ? { branchId: typeof body.branchId === "string" ? body.branchId : undefined } : {}),
        ...(body.roleTitle !== undefined ? { roleTitle: typeof body.roleTitle === "string" ? body.roleTitle.trim() : undefined } : {}),
        ...(body.baseSalaryVnd !== undefined ? { baseSalaryVnd: Number(body.baseSalaryVnd) } : {}),
        ...(body.allowanceVnd !== undefined ? { allowanceVnd: Number(body.allowanceVnd) } : {}),
        ...(body.standardDays !== undefined ? { standardDays: Number(body.standardDays) } : {}),
        ...(body.commissionSchemeId !== undefined ? { commissionSchemeId: typeof body.commissionSchemeId === "string" ? body.commissionSchemeId : null } : {}),
        ...(body.effectiveFrom !== undefined ? { effectiveFrom: new Date(body.effectiveFrom) } : {}),
        ...(body.effectiveTo !== undefined ? { effectiveTo: body.effectiveTo ? new Date(body.effectiveTo) : null } : {}),
      },
    });

    return NextResponse.json({ profile });
  } catch {
    return jsonError(500, "INTERNAL_ERROR", "Internal server error");
  }
}
