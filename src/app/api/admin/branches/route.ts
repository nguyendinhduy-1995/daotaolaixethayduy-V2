import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError } from "@/lib/api-response";
import { requireRouteAuth } from "@/lib/route-auth";
import { requireAdminRole } from "@/lib/admin-auth";

export async function GET(req: Request) {
  const auth = requireRouteAuth(req);
  if (auth.error) return auth.error;
  const adminError = requireAdminRole(auth.auth.role);
  if (adminError) return adminError;

  try {
    const items = await prisma.branch.findMany({ orderBy: { createdAt: "desc" } });
    return NextResponse.json({ items });
  } catch {
    return jsonError(500, "INTERNAL_ERROR", "Internal server error");
  }
}

export async function POST(req: Request) {
  const auth = requireRouteAuth(req);
  if (auth.error) return auth.error;
  const adminError = requireAdminRole(auth.auth.role);
  if (adminError) return adminError;

  try {
    const body = await req.json().catch(() => null);
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    if (!name) return jsonError(400, "VALIDATION_ERROR", "name is required");

    const branch = await prisma.branch.create({
      data: {
        name,
        isActive: typeof body?.isActive === "boolean" ? body.isActive : true,
        commissionPerPaid50:
          Number.isInteger(body?.commissionPerPaid50) && body.commissionPerPaid50 >= 0
            ? body.commissionPerPaid50
            : null,
      },
    });
    return NextResponse.json({ branch });
  } catch {
    return jsonError(500, "INTERNAL_ERROR", "Internal server error");
  }
}
