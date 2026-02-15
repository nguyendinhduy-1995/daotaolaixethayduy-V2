import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type UpsertInput = {
  date: string;
  source: string;
  spendVnd: number;
  messages: number;
  branchId?: string;
  branchCode?: string;
  meta?: unknown;
};

type ListInput = {
  from?: string;
  to?: string;
  branchId?: string;
  source?: string;
};

const OPS_TZ = process.env.OPS_TZ || "Asia/Ho_Chi_Minh";

function isValidDateYmd(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime());
}

function normalizeSource(value: string) {
  const source = value.trim().toLowerCase();
  return source || "meta";
}

function dateToUtc(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

function normalizeDateInOpsTz(value: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: OPS_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value);
  const y = parts.find((p) => p.type === "year")?.value;
  const m = parts.find((p) => p.type === "month")?.value;
  const d = parts.find((p) => p.type === "day")?.value;
  return `${y}-${m}-${d}`;
}

function toInt(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return Math.round(value);
}

async function resolveBranchId(branchId?: string, branchCode?: string) {
  if (branchId) {
    const branch = await prisma.branch.findUnique({ where: { id: branchId }, select: { id: true } });
    if (branch) return branch.id;
  }
  if (branchCode) {
    const branch = await prisma.branch.findFirst({
      where: { code: { equals: branchCode.trim(), mode: "insensitive" } },
      select: { id: true },
    });
    if (branch) return branch.id;
  }
  return null;
}

export function validateReportInput(raw: Record<string, unknown>) {
  const date = typeof raw.date === "string" ? raw.date.trim() : "";
  const source = normalizeSource(typeof raw.source === "string" ? raw.source : "meta");
  const spendVnd = toInt(raw.spendVnd);
  const messages = toInt(raw.messages);
  const branchId = typeof raw.branchId === "string" ? raw.branchId.trim() : undefined;
  const branchCode = typeof raw.branchCode === "string" ? raw.branchCode.trim() : undefined;

  if (!isValidDateYmd(date)) return { ok: false as const, error: "date phải đúng định dạng YYYY-MM-DD" };
  if (spendVnd === null || spendVnd < 0) return { ok: false as const, error: "spendVnd phải >= 0" };
  if (messages === null || messages < 0) return { ok: false as const, error: "messages phải >= 0" };

  return {
    ok: true as const,
    data: {
      date,
      source,
      spendVnd,
      messages,
      branchId: branchId || undefined,
      branchCode: branchCode || undefined,
      meta: raw.meta,
    },
  };
}

export async function upsertDailyReport(input: UpsertInput) {
  const branchId = await resolveBranchId(input.branchId, input.branchCode);
  const dateKey = input.date;
  const cplVnd = Math.round(input.spendVnd / Math.max(input.messages, 1));
  const metaJson =
    input.meta && typeof input.meta === "object"
      ? (input.meta as Prisma.InputJsonValue)
      : Prisma.JsonNull;

  const item =
    branchId !== null
      ? await prisma.marketingReport.upsert({
          where: {
            dateKey_branchId_source: {
              dateKey,
              branchId,
              source: input.source,
            },
          },
          create: {
            date: dateToUtc(dateKey),
            dateKey,
            branchId,
            source: input.source,
            spendVnd: input.spendVnd,
            messages: input.messages,
            cplVnd,
            metaJson,
          },
          update: {
            spendVnd: input.spendVnd,
            messages: input.messages,
            cplVnd,
            metaJson,
            date: dateToUtc(dateKey),
          },
          include: {
            branch: { select: { id: true, name: true } },
          },
        })
      : await prisma.$transaction(async (tx) => {
          const existing = await tx.marketingReport.findFirst({
            where: {
              dateKey,
              branchId: null,
              source: input.source,
            },
            select: { id: true },
          });

          if (existing) {
            return tx.marketingReport.update({
              where: { id: existing.id },
              data: {
                spendVnd: input.spendVnd,
                messages: input.messages,
                cplVnd,
                metaJson,
                date: dateToUtc(dateKey),
              },
              include: {
                branch: { select: { id: true, name: true } },
              },
            });
          }

          return tx.marketingReport.create({
            data: {
              date: dateToUtc(dateKey),
              dateKey,
              branchId: null,
              source: input.source,
              spendVnd: input.spendVnd,
              messages: input.messages,
              cplVnd,
              metaJson,
            },
            include: {
              branch: { select: { id: true, name: true } },
            },
          });
        });

  return item;
}

export async function listReports(input: ListInput) {
  const source = input.source?.trim().toLowerCase();
  const where: {
    dateKey?: { gte?: string; lte?: string };
    branchId?: string;
    source?: string;
  } = {};

  if (input.from || input.to) {
    where.dateKey = {
      ...(input.from ? { gte: input.from } : {}),
      ...(input.to ? { lte: input.to } : {}),
    };
  }
  if (input.branchId) where.branchId = input.branchId;
  if (source) where.source = source;

  const items = await prisma.marketingReport.findMany({
    where,
    include: {
      branch: { select: { id: true, name: true } },
    },
    orderBy: [{ dateKey: "asc" }, { createdAt: "asc" }],
  });

  const totals = items.reduce(
    (acc, item) => {
      acc.spendVnd += item.spendVnd;
      acc.messages += item.messages;
      return acc;
    },
    { spendVnd: 0, messages: 0 }
  );

  return {
    items: items.map((item) => ({
      ...item,
      date: normalizeDateInOpsTz(item.date),
    })),
    totals: {
      spendVnd: totals.spendVnd,
      messages: totals.messages,
      cplVnd: Math.round(totals.spendVnd / Math.max(totals.messages, 1)),
    },
    tz: OPS_TZ,
  };
}
