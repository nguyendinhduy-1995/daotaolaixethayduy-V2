import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError } from "@/lib/api-response";
import { requireMappedRoutePermissionAuth } from "@/lib/route-auth";

export async function GET(req: Request) {
  const auth = await requireMappedRoutePermissionAuth(req);
  if (auth.error) return auth.error;

  try {
    const { searchParams } = new URL(req.url);
    const month = searchParams.get("month") || "";
    if (!/^\d{4}-\d{2}$/.test(month)) {
      return jsonError(400, "VALIDATION_ERROR", "Month không hợp lệ");
    }

    const runs = await prisma.payrollRun.findMany({
      where: { month },
      include: {
        branch: { select: { id: true, name: true } },
        items: {
          where: { userId: auth.auth.sub },
          include: { user: { select: { id: true, name: true, email: true } } },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const items = runs
      .flatMap((run) =>
        run.items.map((item) => ({
          ...item,
          month: run.month,
          runStatus: run.status,
          branch: run.branch,
          generatedAt: run.generatedAt,
          runId: run.id,
        }))
      )
      .sort((a, b) => b.month.localeCompare(a.month));

    return NextResponse.json({ items });
  } catch (err) {
    console.error("[me.payroll]", err);
    return jsonError(500, "INTERNAL_ERROR", "Internal server error");
  }
}
