import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type BuildPaid50Input = {
  month: string;
  branchId?: string;
  dryRun: boolean;
};

type Paid50Candidate = {
  studentId: string;
  studentName: string;
  ownerId: string;
  ownerName: string;
  branchId: string;
  branchName: string;
  periodMonth: string;
  reachedAt: Date;
  paid50Amount: number;
  totalPaidAllTime: number;
  amountVnd: number;
};

function isValidMonth(value: string) {
  if (!/^\d{4}-\d{2}$/.test(value)) return false;
  const month = Number(value.slice(5, 7));
  return month >= 1 && month <= 12;
}

function getPeriodMonth(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  return `${year}-${month}`;
}

function resolvePaid50Amount(totalTuition: number | null | undefined) {
  if (!Number.isInteger(totalTuition) || (totalTuition as number) <= 0) return 0;
  return Math.floor((totalTuition as number) * 0.5);
}

export async function computePaid50ReachedAt(studentId: string, paid50Amount: number) {
  if (!studentId || paid50Amount <= 0) return null;

  const receipts = await prisma.receipt.findMany({
    where: { studentId },
    select: { id: true, amount: true, createdAt: true },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });

  let cumulative = 0;
  for (const receipt of receipts) {
    cumulative += receipt.amount;
    if (cumulative >= paid50Amount) {
      return {
        reachedAt: receipt.createdAt,
        totalPaidAllTime: cumulative,
      };
    }
  }

  return null;
}

export async function buildPaid50Commission(input: BuildPaid50Input) {
  const month = input.month?.trim();
  if (!isValidMonth(month)) throw new Error("INVALID_MONTH");

  if (input.branchId) {
    const targetBranch = await prisma.branch.findUnique({ where: { id: input.branchId }, select: { id: true } });
    if (!targetBranch) throw new Error("BRANCH_NOT_FOUND");
  }

  const now = new Date();

  const students = await prisma.student.findMany({
    select: {
      id: true,
      tuitionSnapshot: true,
      tuitionPlan: { select: { tuition: true } },
      lead: {
        select: {
          id: true,
          fullName: true,
          ownerId: true,
          owner: { select: { id: true, name: true, email: true } },
        },
      },
    },
  });

  const ownerIds = [...new Set(students.map((s) => s.lead.ownerId).filter(Boolean))] as string[];

  const ownerProfiles = await prisma.salaryProfile.findMany({
    where: {
      userId: { in: ownerIds },
      effectiveFrom: { lte: now },
      OR: [{ effectiveTo: null }, { effectiveTo: { gte: now } }],
    },
    include: { branch: { select: { id: true, name: true, commissionPerPaid50: true } } },
    orderBy: [{ userId: "asc" }, { effectiveFrom: "desc" }],
  });

  const profileByOwner = new Map<string, (typeof ownerProfiles)[number]>();
  for (const profile of ownerProfiles) {
    if (!profileByOwner.has(profile.userId)) profileByOwner.set(profile.userId, profile);
  }

  const existingPaid50 = await prisma.commissionLedger.findMany({
    where: {
      sourceType: "PAID50",
      studentId: { in: students.map((s) => s.id) },
    },
    select: { studentId: true },
  });
  const countedStudentIds = new Set(existingPaid50.map((item) => item.studentId).filter(Boolean));

  const preview: Paid50Candidate[] = [];
  let skipNoThreshold = 0;
  let skipWrongMonth = 0;
  let skipAlreadyCounted = 0;
  let skipMissingOwner = 0;
  let skipMissingBranch = 0;
  let skipMissingRate = 0;
  let skippedByBranchScope = 0;

  for (const student of students) {
    const paid50Amount = resolvePaid50Amount(student.tuitionSnapshot ?? student.tuitionPlan?.tuition);
    if (paid50Amount <= 0) {
      skipNoThreshold += 1;
      continue;
    }

    const reached = await computePaid50ReachedAt(student.id, paid50Amount);
    if (!reached) {
      skipNoThreshold += 1;
      continue;
    }

    const periodMonth = getPeriodMonth(reached.reachedAt);
    if (periodMonth !== month) {
      skipWrongMonth += 1;
      continue;
    }

    if (countedStudentIds.has(student.id)) {
      skipAlreadyCounted += 1;
      continue;
    }

    const ownerId = student.lead.ownerId;
    if (!ownerId) {
      skipMissingOwner += 1;
      continue;
    }

    const profile = profileByOwner.get(ownerId);
    if (!profile) {
      skipMissingBranch += 1;
      continue;
    }

    const branch = profile.branch;
    if (input.branchId && branch.id !== input.branchId) {
      skippedByBranchScope += 1;
      continue;
    }

    const rate = branch.commissionPerPaid50 ?? 0;
    if (!Number.isInteger(rate) || rate <= 0) {
      skipMissingRate += 1;
      continue;
    }

    preview.push({
      studentId: student.id,
      studentName: student.lead.fullName || student.id,
      ownerId,
      ownerName: student.lead.owner?.name || student.lead.owner?.email || ownerId,
      branchId: branch.id,
      branchName: branch.name,
      periodMonth,
      reachedAt: reached.reachedAt,
      paid50Amount,
      totalPaidAllTime: reached.totalPaidAllTime,
      amountVnd: rate,
    });
  }

  if (!input.dryRun && preview.length > 0) {
    await prisma.commissionLedger.createMany({
      data: preview.map((item) => ({
        userId: item.ownerId,
        branchId: item.branchId,
        periodMonth: item.periodMonth,
        sourceType: "PAID50",
        sourceId: null,
        studentId: item.studentId,
        amountBaseVnd: item.paid50Amount,
        commissionVnd: item.amountVnd,
        note: "Hoa hồng học viên đạt mốc 50%",
        metaJson: {
          reachedAt: item.reachedAt.toISOString(),
          paid50Amount: item.paid50Amount,
          totalPaidAllTime: item.totalPaidAllTime,
        } as Prisma.InputJsonValue,
      })),
      skipDuplicates: true,
    });
  }

  return {
    ok: true,
    dryRun: input.dryRun,
    month,
    branchId: input.branchId || null,
    created: input.dryRun ? 0 : preview.length,
    previewCount: preview.length,
    totalCommissionVnd: preview.reduce((sum, item) => sum + item.amountVnd, 0),
    summary: {
      skipNoThreshold,
      skipWrongMonth,
      skipAlreadyCounted,
      skipMissingOwner,
      skipMissingBranch,
      skipMissingRate,
      skippedByBranchScope,
    },
    preview: preview.slice(0, 10),
  };
}
