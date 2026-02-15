import { Prisma, type Attendance as AttendanceModel, type SalaryProfile as SalaryProfileModel } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type AttendanceLike = Pick<AttendanceModel, "status">;

type ProfileLike = Pick<
  SalaryProfileModel,
  "id" | "userId" | "branchId" | "baseSalaryVnd" | "allowanceVnd" | "standardDays" | "effectiveFrom" | "effectiveTo"
>;

type PayrollAdjustments = {
  penaltyVnd?: number;
  bonusVnd?: number;
};

function monthStart(month: string) {
  return new Date(`${month}-01T00:00:00.000Z`);
}

function nextMonthStart(month: string) {
  const [y, m] = month.split("-").map(Number);
  const date = new Date(Date.UTC(y, m, 1));
  return date;
}

function isValidMonth(value: string) {
  if (!/^\d{4}-\d{2}$/.test(value)) return false;
  const m = Number(value.slice(5, 7));
  return m >= 1 && m <= 12;
}

export function computeDaysWorked(attendances: AttendanceLike[], standardDays: number) {
  if (standardDays <= 0) return 0;
  const total = attendances.reduce((sum, item) => {
    if (item.status === "PRESENT" || item.status === "LATE" || item.status === "LEAVE_PAID") return sum + 1;
    if (item.status === "HALF") return sum + 0.5;
    return sum;
  }, 0);
  return Math.min(standardDays, total);
}

export function computePayrollItem(
  profile: ProfileLike,
  attendances: AttendanceLike[],
  commissionSum: number,
  adjustments: PayrollAdjustments = {}
) {
  const daysWorked = computeDaysWorked(attendances, profile.standardDays);
  const baseProratedVnd = Math.round((profile.baseSalaryVnd * daysWorked) / Math.max(profile.standardDays, 1));
  const penaltyVnd = adjustments.penaltyVnd ?? 0;
  const bonusVnd = adjustments.bonusVnd ?? 0;
  const totalVnd = baseProratedVnd + profile.allowanceVnd + commissionSum + bonusVnd - penaltyVnd;

  return {
    baseSalaryVnd: profile.baseSalaryVnd,
    allowanceVnd: profile.allowanceVnd,
    daysWorked,
    standardDays: profile.standardDays,
    baseProratedVnd,
    commissionVnd: commissionSum,
    penaltyVnd,
    bonusVnd,
    totalVnd,
    breakdownJson: {
      attendances: attendances.length,
      standardDays: profile.standardDays,
      daysWorked,
      commissionSum,
      adjustments: { penaltyVnd, bonusVnd },
    },
  };
}

export async function generatePayrollRun(month: string, branchId: string, dryRun: boolean, generatedById?: string) {
  if (!isValidMonth(month)) throw new Error("INVALID_MONTH");
  if (!branchId) throw new Error("INVALID_BRANCH");

  const from = monthStart(month);
  const to = nextMonthStart(month);

  const branch = await prisma.branch.findUnique({ where: { id: branchId }, select: { id: true } });
  if (!branch) throw new Error("BRANCH_NOT_FOUND");

  const existingRun = await prisma.payrollRun.findUnique({
    where: { month_branchId: { month, branchId } },
    include: { items: true },
  });
  if (existingRun?.status === "FINAL") throw new Error("PAYROLL_FINALIZED");

  const profiles = await prisma.salaryProfile.findMany({
    where: {
      branchId,
      effectiveFrom: { lt: to },
      OR: [{ effectiveTo: null }, { effectiveTo: { gte: from } }],
    },
    orderBy: [{ userId: "asc" }, { effectiveFrom: "desc" }],
  });

  const latestProfileByUser = new Map<string, ProfileLike>();
  for (const profile of profiles) {
    if (!latestProfileByUser.has(profile.userId)) latestProfileByUser.set(profile.userId, profile);
  }

  const users = [...latestProfileByUser.keys()];
  const [attendances, commissionRows] = await Promise.all([
    prisma.attendance.findMany({
      where: {
        branchId,
        userId: { in: users },
        date: { gte: from, lt: to },
      },
    }),
    prisma.commissionLedger.findMany({
      where: {
        branchId,
        periodMonth: month,
        userId: { in: users },
      },
    }),
  ]);

  const attendanceByUser = new Map<string, AttendanceModel[]>();
  for (const item of attendances) {
    const arr = attendanceByUser.get(item.userId) || [];
    arr.push(item);
    attendanceByUser.set(item.userId, arr);
  }

  const commissionByUser = new Map<string, number>();
  for (const row of commissionRows) {
    commissionByUser.set(row.userId, (commissionByUser.get(row.userId) || 0) + row.commissionVnd);
  }

  const computedItems = users.map((userId) => {
    const profile = latestProfileByUser.get(userId)!;
    const item = computePayrollItem(
      profile,
      attendanceByUser.get(userId) || [],
      commissionByUser.get(userId) || 0
    );
    return { userId, ...item };
  });

  if (dryRun) {
    return {
      dryRun: true,
      month,
      branchId,
      status: existingRun?.status || "DRAFT",
      items: computedItems,
      totals: {
        totalVnd: computedItems.reduce((sum, i) => sum + i.totalVnd, 0),
        commissionVnd: computedItems.reduce((sum, i) => sum + i.commissionVnd, 0),
      },
    };
  }

  const run = await prisma.$transaction(async (tx) => {
    const payrollRun =
      existingRun ||
      (await tx.payrollRun.create({
        data: {
          month,
          branchId,
          status: "DRAFT",
          generatedAt: new Date(),
          generatedById: generatedById || null,
        },
      }));

    await tx.payrollItem.deleteMany({ where: { payrollRunId: payrollRun.id } });

    if (computedItems.length > 0) {
      await tx.payrollItem.createMany({
        data: computedItems.map((item) => ({
          payrollRunId: payrollRun.id,
          userId: item.userId,
          baseSalaryVnd: item.baseSalaryVnd,
          allowanceVnd: item.allowanceVnd,
          daysWorked: item.daysWorked,
          standardDays: item.standardDays,
          baseProratedVnd: item.baseProratedVnd,
          commissionVnd: item.commissionVnd,
          penaltyVnd: item.penaltyVnd,
          bonusVnd: item.bonusVnd,
          totalVnd: item.totalVnd,
          breakdownJson: item.breakdownJson as Prisma.InputJsonValue,
        })),
      });
    }

    return tx.payrollRun.update({
      where: { id: payrollRun.id },
      data: {
        status: "DRAFT",
        generatedAt: new Date(),
        generatedById: generatedById || payrollRun.generatedById || null,
      },
      include: { items: true },
    });
  });

  return {
    dryRun: false,
    run,
    totals: {
      totalVnd: run.items.reduce((sum, i) => sum + i.totalVnd, 0),
      commissionVnd: run.items.reduce((sum, i) => sum + i.commissionVnd, 0),
    },
  };
}

export async function finalizePayrollRun(month: string, branchId: string) {
  if (!isValidMonth(month)) throw new Error("INVALID_MONTH");
  const run = await prisma.payrollRun.findUnique({ where: { month_branchId: { month, branchId } } });
  if (!run) throw new Error("PAYROLL_NOT_FOUND");
  if (run.status === "FINAL") return run;
  return prisma.payrollRun.update({
    where: { id: run.id },
    data: { status: "FINAL" },
  });
}
