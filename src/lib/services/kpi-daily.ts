import type { AuthPayload } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { applyScopeToWhere, resolveScope } from "@/lib/scope";

export const KPI_TIME_ZONE = "Asia/Ho_Chi_Minh";

export class KpiDateError extends Error {
  constructor(message: string) {
    super(message);
  }
}

type RatioValue = {
  numerator: number;
  denominator: number;
  valuePct: number;
};

type KpiDailyResult = {
  date: string;
  monthKey: string;
  timezone: string;
  monthlyClosed: boolean;
  directPage: {
    hasPhoneRate: {
      daily: RatioValue;
      monthly: RatioValue;
    };
  };
  tuVan: {
    appointedRate: {
      daily: RatioValue;
      monthly: RatioValue;
    };
    arrivedRate: {
      daily: RatioValue;
      monthly: RatioValue;
    };
    signedRate: {
      daily: RatioValue;
      monthly: RatioValue;
    };
  };
};

type ScopedLead = {
  id: string;
  ownerId: string | null;
  createdAt: Date;
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
    throw new KpiDateError("Không thể xác định ngày hiện tại");
  }

  return `${year}-${month}-${day}`;
}

function isValidDateString(dateStr: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;
  const [year, month, day] = dateStr.split("-").map(Number);
  const utc = new Date(Date.UTC(year, month - 1, day));
  return utc.getUTCFullYear() === year && utc.getUTCMonth() === month - 1 && utc.getUTCDate() === day;
}

export function resolveKpiDateParam(dateParam: string | null) {
  if (!dateParam) return getCurrentDateInTimeZone();
  if (!isValidDateString(dateParam)) {
    throw new KpiDateError("Ngày không hợp lệ, cần định dạng YYYY-MM-DD");
  }
  return dateParam;
}

function dayRangeInHoChiMinh(dateStr: string) {
  const start = new Date(`${dateStr}T00:00:00.000+07:00`);
  const end = new Date(`${dateStr}T23:59:59.999+07:00`);
  return { start, end };
}

function monthRangeInHoChiMinh(dateStr: string) {
  const [year, month] = dateStr.split("-").map(Number);
  const monthStr = String(month).padStart(2, "0");
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const start = new Date(`${year}-${monthStr}-01T00:00:00.000+07:00`);
  const end = new Date(`${year}-${monthStr}-${String(lastDay).padStart(2, "0")}T23:59:59.999+07:00`);
  return { start, end, lastDay, monthKey: `${year}-${monthStr}` };
}

function toPercent(numerator: number, denominator: number): RatioValue {
  if (denominator <= 0) return { numerator, denominator, valuePct: 0 };
  return {
    numerator,
    denominator,
    valuePct: Number(((numerator / denominator) * 100).toFixed(2)),
  };
}

function toRecord(value: unknown) {
  if (!value || typeof value !== "object") return {};
  return value as Record<string, unknown>;
}

function extractToOwnerId(payload: unknown) {
  const root = toRecord(payload);
  const meta = toRecord(root.meta);
  const direct = typeof root.toOwnerId === "string" ? root.toOwnerId : "";
  const nested = typeof meta.toOwnerId === "string" ? meta.toOwnerId : "";
  return direct || nested || null;
}

async function getScopedLeads(auth: AuthPayload) {
  const scope = await resolveScope(auth);
  const where = applyScopeToWhere({}, scope, "lead");
  const leads = await prisma.lead.findMany({
    where,
    select: { id: true, ownerId: true, createdAt: true },
  });
  return { scope, leads };
}

async function countDistinctEventByLead(
  leadIds: string[],
  type: "HAS_PHONE" | "APPOINTED" | "ARRIVED" | "SIGNED",
  start: Date,
  end: Date
) {
  if (leadIds.length === 0) return 0;
  const rows = await prisma.leadEvent.groupBy({
    by: ["leadId"],
    where: {
      leadId: { in: leadIds },
      type,
      createdAt: { gte: start, lte: end },
    },
  });
  return rows.length;
}

async function buildAssignedAtMap(scopeOwnerId: string | undefined, leads: ScopedLead[]) {
  const assignedAtByLead = new Map<string, Date>();
  const consideredLeadIds: string[] = [];

  if (!scopeOwnerId) {
    for (const lead of leads) {
      assignedAtByLead.set(lead.id, lead.createdAt);
      consideredLeadIds.push(lead.id);
    }
    return { assignedAtByLead, consideredLeadIds };
  }

  const leadIds = leads.map((lead) => lead.id);
  const ownerChanged = await prisma.leadEvent.findMany({
    where: { leadId: { in: leadIds }, type: "OWNER_CHANGED" },
    select: { leadId: true, createdAt: true, payload: true },
    orderBy: [{ leadId: "asc" }, { createdAt: "asc" }],
  });

  for (const event of ownerChanged) {
    const toOwnerId = extractToOwnerId(event.payload);
    if (toOwnerId !== scopeOwnerId) continue;
    if (!assignedAtByLead.has(event.leadId)) {
      assignedAtByLead.set(event.leadId, event.createdAt);
    }
  }

  for (const lead of leads) {
    if (assignedAtByLead.has(lead.id)) {
      consideredLeadIds.push(lead.id);
      continue;
    }
    // Assumption for legacy data: nếu chưa có OWNER_CHANGED nhưng lead đang thuộc owner hiện tại,
    // dùng createdAt của lead làm mốc "nhận lead" để tính denominator.
    if (lead.ownerId === scopeOwnerId) {
      assignedAtByLead.set(lead.id, lead.createdAt);
      consideredLeadIds.push(lead.id);
    }
  }

  return { assignedAtByLead, consideredLeadIds };
}

async function buildFirstHasPhoneMap(leadIds: string[]) {
  const firstHasPhoneMap = new Map<string, Date>();
  if (leadIds.length === 0) return firstHasPhoneMap;
  const rows = await prisma.leadEvent.groupBy({
    by: ["leadId"],
    where: {
      leadId: { in: leadIds },
      type: "HAS_PHONE",
    },
    _min: { createdAt: true },
  });
  for (const row of rows) {
    if (row._min.createdAt) firstHasPhoneMap.set(row.leadId, row._min.createdAt);
  }
  return firstHasPhoneMap;
}

async function countUnphonedMessagesToEnd(
  leadIds: string[],
  assignedAtByLead: Map<string, Date>,
  firstHasPhoneMap: Map<string, Date>,
  end: Date
) {
  if (leadIds.length === 0) return 0;
  let minAssignedAt: Date | null = null;
  for (const leadId of leadIds) {
    const assignedAt = assignedAtByLead.get(leadId);
    if (!assignedAt) continue;
    if (!minAssignedAt || assignedAt < minAssignedAt) minAssignedAt = assignedAt;
  }
  if (!minAssignedAt) return 0;

  const messages = await prisma.leadMessage.findMany({
    where: {
      leadId: { in: leadIds },
      direction: "inbound",
      createdAt: { gte: minAssignedAt, lte: end },
    },
    select: { leadId: true, createdAt: true },
  });

  let count = 0;
  for (const msg of messages) {
    const assignedAt = assignedAtByLead.get(msg.leadId);
    if (!assignedAt || msg.createdAt < assignedAt) continue;
    const firstHasPhoneAt = firstHasPhoneMap.get(msg.leadId);
    if (firstHasPhoneAt && msg.createdAt >= firstHasPhoneAt) continue;
    count += 1;
  }
  return count;
}

async function countHasPhoneConversions(
  leadIds: string[],
  assignedAtByLead: Map<string, Date>,
  start: Date,
  end: Date
) {
  if (leadIds.length === 0) return 0;
  const rows = await prisma.leadEvent.findMany({
    where: {
      leadId: { in: leadIds },
      type: "HAS_PHONE",
      createdAt: { gte: start, lte: end },
    },
    select: { leadId: true, createdAt: true },
    orderBy: [{ leadId: "asc" }, { createdAt: "asc" }],
  });

  const picked = new Set<string>();
  for (const row of rows) {
    const assignedAt = assignedAtByLead.get(row.leadId);
    if (assignedAt && row.createdAt < assignedAt) continue;
    picked.add(row.leadId);
  }
  return picked.size;
}

export async function getKpiDaily(date: string, auth: AuthPayload): Promise<KpiDailyResult> {
  const { start: dayStart, end: dayEnd } = dayRangeInHoChiMinh(date);
  const { start: monthStart, end: monthEnd, lastDay, monthKey } = monthRangeInHoChiMinh(date);
  const day = Number(date.split("-")[2]);
  const monthlyClosed = day === lastDay;
  const monthEndApplied = day < lastDay ? dayEnd : monthEnd;

  const { scope, leads } = await getScopedLeads(auth);
  const allLeadIds = leads.map((lead) => lead.id);

  const { assignedAtByLead, consideredLeadIds } = await buildAssignedAtMap(scope.ownerId, leads);
  const firstHasPhoneMap = await buildFirstHasPhoneMap(consideredLeadIds);

  const [directDenominatorDaily, directDenominatorMonthly, directNumeratorDaily, directNumeratorMonthly] = await Promise.all([
    countUnphonedMessagesToEnd(consideredLeadIds, assignedAtByLead, firstHasPhoneMap, dayEnd),
    countUnphonedMessagesToEnd(consideredLeadIds, assignedAtByLead, firstHasPhoneMap, monthEndApplied),
    countHasPhoneConversions(consideredLeadIds, assignedAtByLead, dayStart, dayEnd),
    countHasPhoneConversions(consideredLeadIds, assignedAtByLead, monthStart, monthEndApplied),
  ]);

  const [hasPhoneDaily, appointedDaily, arrivedDaily, signedDaily, hasPhoneMonthly, appointedMonthly, arrivedMonthly, signedMonthly] =
    await Promise.all([
      countDistinctEventByLead(allLeadIds, "HAS_PHONE", dayStart, dayEnd),
      countDistinctEventByLead(allLeadIds, "APPOINTED", dayStart, dayEnd),
      countDistinctEventByLead(allLeadIds, "ARRIVED", dayStart, dayEnd),
      countDistinctEventByLead(allLeadIds, "SIGNED", dayStart, dayEnd),
      countDistinctEventByLead(allLeadIds, "HAS_PHONE", monthStart, monthEndApplied),
      countDistinctEventByLead(allLeadIds, "APPOINTED", monthStart, monthEndApplied),
      countDistinctEventByLead(allLeadIds, "ARRIVED", monthStart, monthEndApplied),
      countDistinctEventByLead(allLeadIds, "SIGNED", monthStart, monthEndApplied),
    ]);

  return {
    date,
    monthKey,
    timezone: KPI_TIME_ZONE,
    monthlyClosed,
    directPage: {
      hasPhoneRate: {
        daily: toPercent(directNumeratorDaily, directDenominatorDaily),
        monthly: toPercent(directNumeratorMonthly, directDenominatorMonthly),
      },
    },
    tuVan: {
      appointedRate: {
        daily: toPercent(appointedDaily, hasPhoneDaily),
        monthly: toPercent(appointedMonthly, hasPhoneMonthly),
      },
      arrivedRate: {
        daily: toPercent(arrivedDaily, appointedDaily),
        monthly: toPercent(arrivedMonthly, appointedMonthly),
      },
      signedRate: {
        daily: toPercent(signedDaily, arrivedDaily),
        monthly: toPercent(signedMonthly, arrivedMonthly),
      },
    },
  };
}
