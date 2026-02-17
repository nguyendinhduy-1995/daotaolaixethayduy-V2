import { prisma } from "@/lib/prisma";
import { API_ERROR_VI } from "@/lib/api-error-vi";
import type { AuthPayload } from "@/lib/auth";
import { enforceBranchScope, getAllowedBranchIds } from "@/lib/scope";
import { isYmd, isYm, dayRangeInHoChiMinh, monthRangeInHoChiMinh } from "@/lib/utils/date";

const DEFAULT_CATEGORIES = ["Mặt bằng", "Điện nước", "Wifi", "Chi phí khác"] as const;

export class ExpenseValidationError extends Error { }
export class ExpenseForbiddenError extends Error { }

function ensureDateKey(dateKey: string) {
  if (!isYmd(dateKey)) throw new ExpenseValidationError("date phải có dạng YYYY-MM-DD");
  return dateKey;
}

function ensureMonthKey(monthKey: string) {
  if (!isYm(monthKey)) throw new ExpenseValidationError("month phải có dạng YYYY-MM");
  return monthKey;
}

async function resolveScopeBranchIds(auth: AuthPayload, requestedBranchId?: string) {
  const allowed = await getAllowedBranchIds(auth);
  if (requestedBranchId) {
    const scoped = await enforceBranchScope(requestedBranchId, auth, allowed);
    if (!scoped) throw new ExpenseForbiddenError(API_ERROR_VI.forbidden);
    return [scoped];
  }
  if (allowed.length === 0) throw new ExpenseForbiddenError(API_ERROR_VI.forbidden);
  return allowed;
}

const _ensuredBranches = new Set<string>();

async function ensureDefaultCategories(branchId: string) {
  if (_ensuredBranches.has(branchId)) return;
  for (const name of DEFAULT_CATEGORIES) {
    await prisma.expenseCategory.upsert({
      where: { branchId_name: { branchId, name } },
      create: { branchId, name, isActive: true },
      update: { isActive: true },
    });
  }
  _ensuredBranches.add(branchId);
}

export async function getDailyExpenses(input: {
  auth: AuthPayload;
  dateKey: string;
  branchId?: string;
}) {
  const dateKey = ensureDateKey(input.dateKey);
  const branchIds = await resolveScopeBranchIds(input.auth, input.branchId);
  const branchId = branchIds[0];
  if (!branchId) throw new ExpenseForbiddenError(API_ERROR_VI.forbidden);

  await ensureDefaultCategories(branchId);
  const categories = await prisma.expenseCategory.findMany({
    where: { branchId, isActive: true },
    orderBy: { name: "asc" },
  });

  const rows = await prisma.branchExpenseDaily.findMany({
    where: { branchId, dateKey },
    select: {
      id: true,
      categoryId: true,
      amountVnd: true,
      note: true,
      updatedAt: true,
    },
  });
  const byCategory = new Map(rows.map((r) => [r.categoryId, r]));

  const items = categories.map((c) => {
    const row = byCategory.get(c.id);
    return {
      categoryId: c.id,
      categoryName: c.name,
      amountVnd: row?.amountVnd ?? 0,
      note: row?.note ?? "",
      updatedAt: row?.updatedAt ?? null,
    };
  });

  const totalVnd = items.reduce((sum, item) => sum + item.amountVnd, 0);
  return { branchId, dateKey, items, totalVnd };
}

export async function upsertDailyExpenses(input: {
  auth: AuthPayload;
  dateKey: string;
  branchId?: string;
  items: Array<{ categoryId: string; amountVnd: number; note?: string }>;
}) {
  const dateKey = ensureDateKey(input.dateKey);
  if (!Array.isArray(input.items) || input.items.length === 0) {
    throw new ExpenseValidationError(API_ERROR_VI.required);
  }
  const branchIds = await resolveScopeBranchIds(input.auth, input.branchId);
  const branchId = branchIds[0];
  if (!branchId) throw new ExpenseForbiddenError(API_ERROR_VI.forbidden);
  const { start } = dayRangeInHoChiMinh(dateKey);

  const categoryIds = input.items.map((x) => x.categoryId);
  const validCategories = await prisma.expenseCategory.findMany({
    where: { branchId, id: { in: categoryIds }, isActive: true },
    select: { id: true },
  });
  const validSet = new Set(validCategories.map((c) => c.id));

  await prisma.$transaction(async (tx) => {
    for (const item of input.items) {
      if (!validSet.has(item.categoryId)) throw new ExpenseValidationError("Danh mục chi phí không hợp lệ");
      if (!Number.isInteger(item.amountVnd) || item.amountVnd < 0) {
        throw new ExpenseValidationError("Số tiền phải là số nguyên không âm");
      }
      await tx.branchExpenseDaily.upsert({
        where: {
          branchId_dateKey_categoryId: {
            branchId,
            dateKey,
            categoryId: item.categoryId,
          },
        },
        create: {
          branchId,
          date: start,
          dateKey,
          categoryId: item.categoryId,
          amountVnd: item.amountVnd,
          note: item.note?.trim() || null,
          createdById: input.auth.sub,
        },
        update: {
          amountVnd: item.amountVnd,
          note: item.note?.trim() || null,
          createdById: input.auth.sub,
          date: start,
        },
      });
    }
  });

  return getDailyExpenses({ auth: input.auth, dateKey, branchId });
}

export async function getMonthlySummary(input: {
  auth: AuthPayload;
  monthKey: string;
  branchId?: string;
}) {
  const monthKey = ensureMonthKey(input.monthKey);
  const branchIds = await resolveScopeBranchIds(input.auth, input.branchId);
  const { start, end } = monthRangeInHoChiMinh(monthKey);

  const categories = await prisma.expenseCategory.findMany({
    where: { branchId: { in: branchIds }, isActive: true },
    select: { id: true, name: true, branchId: true },
    orderBy: [{ name: "asc" }],
  });
  const categoryMap = new Map(categories.map((c) => [c.id, c]));

  const grouped = await prisma.branchExpenseDaily.groupBy({
    by: ["categoryId"],
    where: {
      branchId: { in: branchIds },
      date: { gte: start, lte: end },
    },
    _sum: { amountVnd: true },
  });

  const totalsByCategory = grouped.map((row) => ({
    categoryId: row.categoryId,
    categoryName: categoryMap.get(row.categoryId)?.name ?? "Khác",
    totalVnd: row._sum.amountVnd ?? 0,
  }));
  const expensesTotalVnd = totalsByCategory.reduce((sum, item) => sum + item.totalVnd, 0);

  const baseSalaries = await prisma.branchBaseSalary.findMany({
    where: {
      branchId: { in: branchIds },
      monthKey,
    },
    select: { baseSalaryVnd: true },
  });
  const baseSalaryTotalVnd = baseSalaries.reduce((sum, item) => sum + item.baseSalaryVnd, 0);

  const insights = await prisma.expenseInsight.findMany({
    where: { branchId: { in: branchIds }, monthKey },
    orderBy: { createdAt: "desc" },
    take: 3,
  });

  return {
    monthKey,
    branchIds,
    totalsByCategory,
    expensesTotalVnd,
    baseSalaryTotalVnd,
    grandTotalVnd: expensesTotalVnd + baseSalaryTotalVnd,
    insights,
  };
}

export async function getBaseSalaryRows(input: {
  auth: AuthPayload;
  monthKey: string;
  branchId?: string;
}) {
  const monthKey = ensureMonthKey(input.monthKey);
  const branchIds = await resolveScopeBranchIds(input.auth, input.branchId);

  const users = await prisma.user.findMany({
    where: { isActive: true, branchId: { in: branchIds } },
    select: { id: true, name: true, email: true, branchId: true },
    orderBy: [{ name: "asc" }],
  });
  const items = await prisma.branchBaseSalary.findMany({
    where: { monthKey, branchId: { in: branchIds } },
    select: { id: true, userId: true, branchId: true, baseSalaryVnd: true, note: true, updatedAt: true },
  });
  const rowMap = new Map(items.map((item) => [`${item.userId}:${item.branchId}`, item]));

  const rows = users.map((u) => {
    const key = `${u.id}:${u.branchId}`;
    const row = rowMap.get(key);
    return {
      userId: u.id,
      name: u.name || u.email,
      email: u.email,
      branchId: u.branchId,
      baseSalaryVnd: row?.baseSalaryVnd ?? 0,
      note: row?.note ?? "",
      updatedAt: row?.updatedAt ?? null,
    };
  });
  const totalVnd = rows.reduce((sum, r) => sum + r.baseSalaryVnd, 0);
  return { monthKey, rows, totalVnd };
}

export async function upsertBaseSalaryRows(input: {
  auth: AuthPayload;
  monthKey: string;
  branchId?: string;
  items: Array<{ userId: string; baseSalaryVnd: number; note?: string }>;
}) {
  const monthKey = ensureMonthKey(input.monthKey);
  if (!Array.isArray(input.items) || input.items.length === 0) {
    throw new ExpenseValidationError(API_ERROR_VI.required);
  }
  const branchIds = await resolveScopeBranchIds(input.auth, input.branchId);

  await prisma.$transaction(async (tx) => {
    for (const item of input.items) {
      if (!Number.isInteger(item.baseSalaryVnd) || item.baseSalaryVnd < 0) {
        throw new ExpenseValidationError("Lương cơ bản phải là số nguyên không âm");
      }
      const user = await tx.user.findUnique({
        where: { id: item.userId },
        select: { id: true, branchId: true },
      });
      if (!user?.branchId || !branchIds.includes(user.branchId)) {
        throw new ExpenseForbiddenError(API_ERROR_VI.forbidden);
      }
      await tx.branchBaseSalary.upsert({
        where: {
          userId_monthKey_branchId: {
            userId: item.userId,
            monthKey,
            branchId: user.branchId,
          },
        },
        create: {
          userId: item.userId,
          monthKey,
          branchId: user.branchId,
          baseSalaryVnd: item.baseSalaryVnd,
          note: item.note?.trim() || null,
        },
        update: {
          baseSalaryVnd: item.baseSalaryVnd,
          note: item.note?.trim() || null,
        },
      });
    }
  });

  return getBaseSalaryRows({ auth: input.auth, monthKey, branchId: input.branchId });
}

export async function listExpenseInsights(input: {
  auth: AuthPayload;
  monthKey?: string;
  dateKey?: string;
  branchId?: string;
}) {
  const branchIds = await resolveScopeBranchIds(input.auth, input.branchId);
  const where = {
    branchId: { in: branchIds },
    ...(input.monthKey ? { monthKey: ensureMonthKey(input.monthKey) } : {}),
    ...(input.dateKey ? { dateKey: ensureDateKey(input.dateKey) } : {}),
  };
  return prisma.expenseInsight.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 50,
  });
}

export async function ingestExpenseInsight(input: {
  branchId?: string;
  branchCode?: string;
  dateKey: string;
  monthKey: string;
  summary: string;
  payloadJson?: unknown;
  source?: string;
  runId?: string;
  payloadHash?: string;
}) {
  const dateKey = ensureDateKey(input.dateKey);
  const monthKey = ensureMonthKey(input.monthKey);
  if (!input.summary?.trim()) throw new ExpenseValidationError(API_ERROR_VI.required);

  let branchId: string | null = null;
  if (input.branchId) {
    const branch = await prisma.branch.findUnique({ where: { id: input.branchId }, select: { id: true } });
    if (!branch) throw new ExpenseValidationError("Chi nhánh không hợp lệ");
    branchId = branch.id;
  } else if (input.branchCode) {
    const branch = await prisma.branch.findUnique({ where: { code: input.branchCode }, select: { id: true } });
    if (!branch) throw new ExpenseValidationError("Chi nhánh không hợp lệ");
    branchId = branch.id;
  }

  return prisma.expenseInsight.create({
    data: {
      branchId,
      dateKey,
      monthKey,
      summary: input.summary.trim(),
      payloadJson: input.payloadJson === undefined ? undefined : (input.payloadJson as never),
      source: input.source?.trim() || "n8n",
      runId: input.runId?.trim() || null,
      payloadHash: input.payloadHash?.trim() || null,
    },
  });
}
