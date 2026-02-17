import type { OutboundJobStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const JOB_STATUSES: OutboundJobStatus[] = ["NEW", "DISPATCHED", "DONE", "FAILED"];

export function parseDateKeyOrToday(input?: string | null) {
  const value = (input || "").trim();
  if (!value) {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Ho_Chi_Minh",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(new Date());
    const y = parts.find((p) => p.type === "year")?.value;
    const m = parts.find((p) => p.type === "month")?.value;
    const d = parts.find((p) => p.type === "day")?.value;
    return `${y}-${m}-${d}`;
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error("INVALID_DATE");
  return value;
}

export function buildDayRangeHcm(dateKey: string) {
  return {
    start: new Date(`${dateKey}T00:00:00.000+07:00`),
    end: new Date(`${dateKey}T23:59:59.999+07:00`),
  };
}

export function buildMonthRangeHcm(dateKey: string) {
  const monthKey = dateKey.slice(0, 7);
  return {
    monthKey,
    start: new Date(`${monthKey}-01T00:00:00.000+07:00`),
    end: new Date(`${monthKey}-31T23:59:59.999+07:00`),
  };
}

export function parseLimit(input: string | null, fallback = 50, max = 200) {
  if (!input) return fallback;
  const value = Number(input);
  if (!Number.isInteger(value) || value <= 0) throw new Error("INVALID_LIMIT");
  return Math.min(value, max);
}

export function parseJobStatus(input: string | null) {
  if (!input) return null;
  const value = input.trim().toUpperCase() as OutboundJobStatus;
  if (!JOB_STATUSES.includes(value)) throw new Error("INVALID_STATUS");
  return value;
}

export async function getAutomationOverview(dateKey: string) {
  const dayRange = buildDayRangeHcm(dateKey);
  const monthRange = buildMonthRangeHcm(dateKey);

  const [jobsTodayRows, jobsMonthRows, logsTodayRows, logsMonthRows] = await Promise.all([
    prisma.outboundJob.groupBy({
      by: ["status"],
      where: { createdAt: { gte: dayRange.start, lte: dayRange.end } },
      _count: { _all: true },
    }),
    prisma.outboundJob.groupBy({
      by: ["status"],
      where: { createdAt: { gte: monthRange.start, lte: monthRange.end } },
      _count: { _all: true },
    }),
    prisma.automationLog.groupBy({
      by: ["milestone"],
      where: { sentAt: { gte: dayRange.start, lte: dayRange.end } },
      _count: { _all: true },
      orderBy: { _count: { milestone: "desc" } },
    }),
    prisma.automationLog.groupBy({
      by: ["milestone"],
      where: { sentAt: { gte: monthRange.start, lte: monthRange.end } },
      _count: { _all: true },
      orderBy: { _count: { milestone: "desc" } },
    }),
  ]);

  const jobsToday = JOB_STATUSES.reduce<Record<OutboundJobStatus, number>>(
    (acc, status) => ({ ...acc, [status]: jobsTodayRows.find((x) => x.status === status)?._count._all || 0 }),
    { NEW: 0, DISPATCHED: 0, DONE: 0, FAILED: 0 }
  );

  const jobsMonth = JOB_STATUSES.reduce<Record<OutboundJobStatus, number>>(
    (acc, status) => ({ ...acc, [status]: jobsMonthRows.find((x) => x.status === status)?._count._all || 0 }),
    { NEW: 0, DISPATCHED: 0, DONE: 0, FAILED: 0 }
  );

  return {
    dateKey,
    monthKey: monthRange.monthKey,
    jobs: {
      today: jobsToday,
      month: jobsMonth,
    },
    logs: {
      todayByMilestone: logsTodayRows.map((x) => ({
        milestone: x.milestone || "khong_xac_dinh",
        count: x._count._all,
      })),
      monthByMilestone: logsMonthRows.map((x) => ({
        milestone: x.milestone || "khong_xac_dinh",
        count: x._count._all,
      })),
    },
  };
}

export async function listAutomationJobs(input: {
  dateKey: string;
  status?: OutboundJobStatus | null;
  branchId?: string | null;
  runId?: string | null;
  channel?: string | null;
  limit: number;
}) {
  const dayRange = buildDayRangeHcm(input.dateKey);
  const where: Prisma.OutboundJobWhereInput = {
    createdAt: { gte: dayRange.start, lte: dayRange.end },
    ...(input.status ? { status: input.status } : {}),
    ...(input.branchId ? { branchId: input.branchId } : {}),
    ...(input.runId ? { runId: input.runId } : {}),
    ...(input.channel
      ? {
          payloadJson: {
            path: ["channel"],
            equals: input.channel.toUpperCase(),
          },
        }
      : {}),
  };

  return prisma.outboundJob.findMany({
    where,
    include: {
      branch: { select: { id: true, name: true } },
      owner: { select: { id: true, name: true, email: true } },
      createdBy: { select: { id: true, name: true, email: true } },
      suggestion: { select: { id: true, title: true } },
      task: { select: { id: true, title: true, status: true, updatedAt: true } },
    },
    orderBy: { createdAt: "desc" },
    take: input.limit,
  });
}

export async function listAutomationLogs(input: {
  dateKey: string;
  milestone?: string | null;
  branchId?: string | null;
  runId?: string | null;
  suggestionId?: string | null;
  outboundJobId?: string | null;
  limit: number;
}) {
  const dayRange = buildDayRangeHcm(input.dateKey);
  const and: Prisma.AutomationLogWhereInput[] = [{ sentAt: { gte: dayRange.start, lte: dayRange.end } }];

  if (input.milestone) and.push({ milestone: input.milestone });
  if (input.branchId) and.push({ branchId: input.branchId });
  if (input.runId) and.push({ payload: { path: ["runId"], equals: input.runId } });
  if (input.suggestionId) and.push({ payload: { path: ["suggestionId"], equals: input.suggestionId } });
  if (input.outboundJobId) and.push({ payload: { path: ["outboundJobId"], equals: input.outboundJobId } });

  return prisma.automationLog.findMany({
    where: { AND: and },
    include: {
      branch: { select: { id: true, name: true } },
      lead: { select: { id: true, fullName: true, phone: true } },
      student: { select: { id: true } },
    },
    orderBy: { sentAt: "desc" },
    take: input.limit,
  });
}

export async function getTopAutomationErrors(input: { dateKey: string; limit: number }) {
  const dayRange = buildDayRangeHcm(input.dateKey);
  const rows = await prisma.outboundJob.findMany({
    where: {
      createdAt: { gte: dayRange.start, lte: dayRange.end },
      status: "FAILED",
      NOT: { lastError: null },
    },
    select: {
      id: true,
      lastError: true,
      runId: true,
      branchId: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: { updatedAt: "desc" },
    take: 500,
  });

  const map = new Map<string, { message: string; count: number; lastSeenAt: Date; exampleRunId: string | null }>();
  for (const row of rows) {
    const message = (row.lastError || "").trim();
    if (!message) continue;
    const current = map.get(message);
    if (!current) {
      map.set(message, {
        message,
        count: 1,
        lastSeenAt: row.updatedAt,
        exampleRunId: row.runId || null,
      });
      continue;
    }
    current.count += 1;
    if (row.updatedAt > current.lastSeenAt) {
      current.lastSeenAt = row.updatedAt;
      current.exampleRunId = row.runId || current.exampleRunId;
    }
    map.set(message, current);
  }

  return [...map.values()]
    .sort((a, b) => b.count - a.count || b.lastSeenAt.getTime() - a.lastSeenAt.getTime())
    .slice(0, input.limit);
}

