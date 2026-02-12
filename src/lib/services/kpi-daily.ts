import { prisma } from "@/lib/prisma";

export const KPI_TIME_ZONE = "Asia/Ho_Chi_Minh";

export class KpiDateError extends Error {
  constructor(message: string) {
    super(message);
  }
}

type KpiDailyResult = {
  date: string;
  leads: { new: number; hasPhone: number };
  telesale: {
    called: number;
    appointed: number;
    arrived: number;
    signed: number;
    studying: number;
    examined: number;
    result: number;
    lost: number;
  };
  finance: {
    totalThu: number;
    totalPhieuThu: number;
    totalRemaining: number;
    countPaid50: number;
  };
};

function getCurrentDateInTimeZone() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: KPI_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const year = parts.find((p) => p.type === "year")?.value;
  const month = parts.find((p) => p.type === "month")?.value;
  const day = parts.find((p) => p.type === "day")?.value;

  if (!year || !month || !day) {
    throw new KpiDateError("Unable to resolve current date");
  }

  return `${year}-${month}-${day}`;
}

function isValidDateString(dateStr: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;

  const [year, month, day] = dateStr.split("-").map(Number);
  const utc = new Date(Date.UTC(year, month - 1, day));

  return (
    utc.getUTCFullYear() === year &&
    utc.getUTCMonth() === month - 1 &&
    utc.getUTCDate() === day
  );
}

export function resolveKpiDateParam(dateParam: string | null) {
  if (!dateParam) return getCurrentDateInTimeZone();
  if (!isValidDateString(dateParam)) {
    throw new KpiDateError("Invalid date format, expected YYYY-MM-DD");
  }
  return dateParam;
}

function dayRangeInHoChiMinh(dateStr: string) {
  // Vietnam has no DST; +07:00 matches Asia/Ho_Chi_Minh boundaries.
  const start = new Date(`${dateStr}T00:00:00.000+07:00`);
  const end = new Date(`${dateStr}T23:59:59.999+07:00`);
  return { start, end };
}

export async function getKpiDaily(date: string): Promise<KpiDailyResult> {
  const { start, end } = dayRangeInHoChiMinh(date);

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

  return {
    date,
    leads: { new: leadsNew, hasPhone: leadsHasPhone },
    telesale: { called, appointed, arrived, signed, studying: studied, examined, result, lost },
    finance: { totalThu, totalPhieuThu, totalRemaining, countPaid50 },
  };
}
