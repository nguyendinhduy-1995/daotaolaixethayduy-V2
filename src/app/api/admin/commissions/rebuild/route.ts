import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError } from "@/lib/api-response";
import { requireMappedRoutePermissionAuth } from "@/lib/route-auth";
import { requireAdminRole } from "@/lib/admin-auth";

function monthRange(month: string) {
  const from = new Date(`${month}-01T00:00:00.000Z`);
  const [y, m] = month.split("-").map(Number);
  const to = new Date(Date.UTC(y, m, 1));
  return { from, to };
}

export async function POST(req: Request) {
  const auth = await requireMappedRoutePermissionAuth(req);
  if (auth.error) return auth.error;
  const adminError = requireAdminRole(auth.auth.role);
  if (adminError) return adminError;

  try {
    const body = await req.json().catch(() => null);
    const month = typeof body?.month === "string" ? body.month : "";
    const branchId = typeof body?.branchId === "string" ? body.branchId : "";
    const dryRun = Boolean(body?.dryRun);

    if (!/^\d{4}-\d{2}$/.test(month) || !branchId) {
      return jsonError(400, "VALIDATION_ERROR", "Invalid payload");
    }

    const { from, to } = monthRange(month);
    const receipts = await prisma.receipt.findMany({
      where: { receivedAt: { gte: from, lt: to } },
      include: { student: { select: { id: true, lead: { select: { ownerId: true } } } } },
    });

    const rows = receipts
      .map((receipt) => {
        const userId = receipt.student?.lead?.ownerId;
        if (!userId) return null;
        return {
          userId,
          branchId,
          periodMonth: month,
          sourceType: "RECEIPT" as const,
          sourceId: receipt.id,
          amountBaseVnd: receipt.amount,
          commissionVnd: 0,
          note: "Auto rebuild từ receipt",
        };
      })
      .filter(Boolean) as Array<{
      userId: string;
      branchId: string;
      periodMonth: string;
      sourceType: "RECEIPT";
      sourceId: string;
      amountBaseVnd: number;
      commissionVnd: number;
      note: string;
    }>;

    if (!dryRun) {
      await prisma.$transaction(async (tx) => {
        await tx.commissionLedger.deleteMany({
          where: { branchId, periodMonth: month, sourceType: "RECEIPT" },
        });
        if (rows.length > 0) {
          await tx.commissionLedger.createMany({
            data: rows,
          });
        }
      });
    }

    return NextResponse.json({ ok: true, dryRun, rebuilt: rows.length });
  } catch {
    return jsonError(500, "INTERNAL_ERROR", "Internal server error");
  }
}
