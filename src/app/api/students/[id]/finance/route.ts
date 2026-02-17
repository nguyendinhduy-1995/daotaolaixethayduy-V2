import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError } from "@/lib/api-response";
import { requireMappedRoutePermissionAuth } from "@/lib/route-auth";
import { API_ERROR_VI } from "@/lib/api-error-vi";
import { applyScopeToWhere, resolveScope } from "@/lib/scope";

type RouteContext = { params: Promise<{ id: string }> | { id: string } };

export async function GET(req: Request, context: RouteContext) {
  const authResult = await requireMappedRoutePermissionAuth(req);
  if (authResult.error) return authResult.error;

  try {
    const scope = await resolveScope(authResult.auth);
    const { id } = await Promise.resolve(context.params);
    const student = await prisma.student.findFirst({
      where: applyScopeToWhere({ id }, scope, "student"),
      select: {
        id: true,
        tuitionSnapshot: true,
        lead: { select: { ownerId: true } },
        tuitionPlan: { select: { tuition: true } },
      },
    });
    if (!student) return jsonError(404, "NOT_FOUND", API_ERROR_VI.notFoundStudent);

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
  } catch (err) {
    console.error("[students.[id].finance]", err);
    return jsonError(500, "INTERNAL_ERROR", API_ERROR_VI.internal);
  }
}
