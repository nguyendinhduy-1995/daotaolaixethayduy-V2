import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

function dayRange(dateStr: string) {
  const start = new Date(`${dateStr}T00:00:00`);
  const end = new Date(`${dateStr}T23:59:59.999`);
  return { start, end };
}

export async function GET(req: Request) {
  try {
    requireAuth(req);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date") || new Date().toISOString().slice(0, 10);
  const { start, end } = dayRange(date);

  const leadsNew = await prisma.lead.count({
    where: { createdAt: { gte: start, lte: end } },
  });

  const leadsHasPhone = await prisma.lead.count({
    where: {
      createdAt: { gte: start, lte: end },
      status: { in: ["HAS_PHONE", "APPOINTED", "ARRIVED", "SIGNED", "STUDYING", "EXAMED", "RESULT"] },
    },
  });

  const [called, appointed, arrived, signed, studied, examined, result, lost] = await Promise.all([
    prisma.leadEvent.count({ where: { type: "CALLED", createdAt: { gte: start, lte: end } } }),
    prisma.leadEvent.count({ where: { type: "APPOINTED", createdAt: { gte: start, lte: end } } }),
    prisma.leadEvent.count({ where: { type: "ARRIVED", createdAt: { gte: start, lte: end } } }),
    prisma.leadEvent.count({ where: { type: "SIGNED", createdAt: { gte: start, lte: end } } }),
    prisma.leadEvent.count({ where: { type: "STUDYING", createdAt: { gte: start, lte: end } } }),
    prisma.leadEvent.count({ where: { type: "EXAMED", createdAt: { gte: start, lte: end } } }),
    prisma.leadEvent.count({ where: { type: "RESULT", createdAt: { gte: start, lte: end } } }),
    prisma.leadEvent.count({ where: { type: "LOST", createdAt: { gte: start, lte: end } } }),
  ]);

  const receiptAgg = await prisma.receipt.aggregate({
    where: { receivedAt: { gte: start, lte: end } },
    _sum: { amount: true },
    _count: { id: true },
  });

  const totalThu = receiptAgg._sum.amount ?? 0;
  const totalPhieuThu = receiptAgg._count.id ?? 0;

  const paidByStudent = await prisma.receipt.groupBy({
    by: ["studentId"],
    _sum: { amount: true },
  });

  const students = await prisma.student.findMany({
    select: { id: true, tuitionSnapshot: true },
  });

  const paidMap = new Map<string, number>();
  for (const row of paidByStudent) paidMap.set(row.studentId, row._sum.amount ?? 0);

  let totalRemaining = 0;
  let countPaid50 = 0;

  for (const s of students) {
    const tuition = s.tuitionSnapshot ?? 0;
    const paid = paidMap.get(s.id) ?? 0;
    totalRemaining += Math.max(0, tuition - paid);
    if (tuition > 0 && paid >= tuition * 0.5) countPaid50 += 1;
  }

  return NextResponse.json({
    date,
    leads: { new: leadsNew, hasPhone: leadsHasPhone },
    telesale: { called, appointed, arrived, signed, studying: studied, examined, result, lost },
    finance: { totalThu, totalPhieuThu, totalRemaining, countPaid50 },
  });
}
