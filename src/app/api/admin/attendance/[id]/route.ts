import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError } from "@/lib/api-response";
import { requireMappedRoutePermissionAuth } from "@/lib/route-auth";
import { requireAdminRole } from "@/lib/admin-auth";

type RouteContext = { params: Promise<{ id: string }> | { id: string } };
const ALLOWED_STATUS = new Set(["PRESENT", "HALF", "OFF", "LEAVE_PAID", "LEAVE_UNPAID", "LATE", "ABSENT"]);

export async function PATCH(req: Request, context: RouteContext) {
  const auth = await requireMappedRoutePermissionAuth(req);
  if (auth.error) return auth.error;
  const adminError = requireAdminRole(auth.auth.role);
  if (adminError) return adminError;

  try {
    const { id } = await Promise.resolve(context.params);
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") return jsonError(400, "VALIDATION_ERROR", "Invalid JSON body");

    const exists = await prisma.attendance.findUnique({ where: { id }, select: { id: true } });
    if (!exists) return jsonError(404, "NOT_FOUND", "Attendance not found");

    const status = body.status !== undefined ? String(body.status).toUpperCase() : undefined;
    if (status !== undefined && !ALLOWED_STATUS.has(status)) {
      return jsonError(400, "VALIDATION_ERROR", "Invalid status");
    }

    const attendance = await prisma.attendance.update({
      where: { id },
      data: {
        ...(status ? { status: status as never } : {}),
        ...(body.minutesLate !== undefined ? { minutesLate: Number(body.minutesLate) || 0 } : {}),
        ...(body.note !== undefined ? { note: body.note ? String(body.note) : null } : {}),
      },
    });

    return NextResponse.json({ attendance });
  } catch (err) {
    console.error("[admin.attendance.[id]]", err);
    return jsonError(500, "INTERNAL_ERROR", "Internal server error");
  }
}
