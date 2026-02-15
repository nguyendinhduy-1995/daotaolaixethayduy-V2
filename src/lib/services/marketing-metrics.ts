import { Prisma } from "@prisma/client";
import type { MarketingGrain } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const MARKETING_SOURCE = "meta_ads";

type IngestInput = {
  source: string;
  grain: MarketingGrain;
  dateKey: string;
  spendVnd: number;
  messages: number;
  meta?: Prisma.InputJsonValue;
};

type MetricsFilter = {
  source?: string;
  grain: MarketingGrain;
  from?: string;
  to?: string;
};

function isDateKeyValid(grain: MarketingGrain, dateKey: string) {
  if (grain === "DAY") {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return false;
    const date = new Date(`${dateKey}T00:00:00.000Z`);
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === dateKey;
  }
  if (grain === "MONTH") {
    if (!/^\d{4}-\d{2}$/.test(dateKey)) return false;
    const month = Number(dateKey.slice(5, 7));
    return month >= 1 && month <= 12;
  }
  if (grain === "YEAR") {
    return /^\d{4}$/.test(dateKey);
  }
  return false;
}

export function validateMarketingInput(raw: Record<string, unknown>) {
  const source = typeof raw.source === "string" ? raw.source.trim().toLowerCase() : "";
  const grain = typeof raw.grain === "string" ? raw.grain.trim().toUpperCase() : "";
  const dateKey = typeof raw.dateKey === "string" ? raw.dateKey.trim() : "";
  const spendVnd = raw.spendVnd;
  const messages = raw.messages;

  if (source !== MARKETING_SOURCE) {
    return { ok: false as const, error: "source must be meta_ads" };
  }
  if (grain !== "DAY" && grain !== "MONTH" && grain !== "YEAR") {
    return { ok: false as const, error: "grain must be DAY | MONTH | YEAR" };
  }
  const grainValue: MarketingGrain = grain;
  if (!isDateKeyValid(grainValue, dateKey)) {
    return { ok: false as const, error: "Invalid dateKey for selected grain" };
  }
  if (typeof spendVnd !== "number" || !Number.isFinite(spendVnd) || spendVnd < 0) {
    return { ok: false as const, error: "spendVnd must be >= 0" };
  }
  if (typeof messages !== "number" || !Number.isInteger(messages) || messages < 0) {
    return { ok: false as const, error: "messages must be integer >= 0" };
  }

  return {
    ok: true as const,
    data: {
      source,
      grain: grainValue,
      dateKey,
      spendVnd: Math.round(spendVnd),
      messages,
      meta: (raw.meta ?? null) as Prisma.InputJsonValue,
    },
  };
}

export async function upsertMarketingMetric(input: IngestInput) {
  const cplVnd = input.spendVnd / Math.max(input.messages, 1);
  return prisma.marketingMetric.upsert({
    where: {
      source_grain_dateKey: {
        source: input.source,
        grain: input.grain,
        dateKey: input.dateKey,
      },
    },
    create: {
      source: input.source,
      grain: input.grain,
      dateKey: input.dateKey,
      spendVnd: input.spendVnd,
      messages: input.messages,
      cplVnd,
      meta: input.meta,
    },
    update: {
      spendVnd: input.spendVnd,
      messages: input.messages,
      cplVnd,
      meta: input.meta,
    },
  });
}

export async function getMarketingMetrics(filter: MetricsFilter) {
  const where: Prisma.MarketingMetricWhereInput = {
    grain: filter.grain,
    ...(filter.source ? { source: filter.source } : {}),
    ...(filter.from || filter.to
      ? {
          dateKey: {
            ...(filter.from ? { gte: filter.from } : {}),
            ...(filter.to ? { lte: filter.to } : {}),
          },
        }
      : {}),
  };

  let items: Awaited<ReturnType<typeof prisma.marketingMetric.findMany>>;
  try {
    items = await prisma.marketingMetric.findMany({
      where,
      orderBy: { dateKey: "asc" },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2021") {
      return {
        items: [],
        totals: {
          spendVnd: 0,
          messages: 0,
          cplVnd: 0,
        },
      };
    }
    throw error;
  }

  const spendVnd = items.reduce((sum, item) => sum + item.spendVnd, 0);
  const messages = items.reduce((sum, item) => sum + item.messages, 0);
  const cplVnd = spendVnd / Math.max(messages, 1);

  return {
    items,
    totals: {
      spendVnd,
      messages,
      cplVnd,
    },
  };
}

export function validateRangeByGrain(grain: MarketingGrain, value?: string) {
  if (!value) return true;
  return isDateKeyValid(grain, value);
}
