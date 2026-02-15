import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError } from "@/lib/api-response";
import { requireRouteAuth } from "@/lib/route-auth";
import { isAdminRole } from "@/lib/admin-auth";

type RouteContext = { params: Promise<{ id: string }> | { id: string } };

export async function GET(req: Request, context: RouteContext) {
  const authResult = requireRouteAuth(req);
  if (authResult.error) return authResult.error;

  try {
    const { id } = await Promise.resolve(context.params);
    const student = await prisma.student.findUnique({
      where: { id },
      select: {
        id: true,
        tuitionSnapshot: true,
        lead: { select: { ownerId: true } },
        tuitionPlan: { select: { tuition: true } },
      },
    });
    if (!student) return jsonError(404, "NOT_FOUND", "Student not found");
    if (!isAdminRole(authResult.auth.role) && student.lead.ownerId !== authResult.auth.sub) {
      return jsonError(403, "AUTH_FORBIDDEN", "Forbidden");
    }

    const agg = await prisma.receipt.aggregate({
      where: { studentId: id },
      _sum: { amount: true },
    });

    const tuitionTotal = student.tuitionSnapshot ?? student.tuitionPlan?.tuition ?? 0;
    const paidTotal = agg._sum.amount ?? 0;
    const remaining = Math.max(0, tuitionTotal - paidTotal);
    const paidRatio = tuitionTotal > 0 ? paidTotal / tuitionTotal : 0;
    const paid50Threshold = Math.floor(tuitionTotal * 0.5);
    const paid50 = tuitionTotal > 0 ? paidTotal >= paid50Threshold : false;

    return NextResponse.json({
      tuitionTotal,
      paidTotal,
      remaining,
      paidRatio,
      paid50,
    });
  } catch {
    return jsonError(500, "INTERNAL_ERROR", "Internal server error");
  }
}
