import type { OpsPulseRole, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type OpsStatus = "OK" | "WARNING" | "CRITICAL";

type PageMetrics = {
  openMessages: number;
  newData: number;
};

type TelesalesMetrics = {
  data: number;
  called: number;
  appointed: number;
  arrived: number;
  signed: number;
};

type PulseTargets = Record<string, number>;

type OpsPulseInput = {
  role: OpsPulseRole;
  ownerId?: string;
  branchId?: string;
  dateKey: string;
  windowMinutes: number;
  metrics: Record<string, unknown>;
  targets?: Record<string, unknown>;
};

export type OpsPulseComputed = {
  role: OpsPulseRole;
  status: OpsStatus;
  metrics: PageMetrics | TelesalesMetrics;
  targets: PulseTargets;
  gaps: Record<string, number>;
  checklist: string[];
  suggestions: string[];
  generatedAt: string;
};

export class OpsPulseValidationError extends Error {}

function todayInHcm() {
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

function parseDateKey(input: unknown) {
  if (input === undefined || input === null || input === "") return todayInHcm();
  if (typeof input !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(input)) {
    throw new OpsPulseValidationError("dateKey must be YYYY-MM-DD");
  }
  return input;
}

function parseWindowMinutes(input: unknown) {
  if (input === undefined || input === null || input === "") return 10;
  if (typeof input !== "number" || !Number.isInteger(input) || input <= 0 || input > 120) {
    throw new OpsPulseValidationError("windowMinutes must be a positive integer <= 120");
  }
  return input;
}

function toNonNegativeNumber(value: unknown, field: string) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new OpsPulseValidationError(`${field} must be a non-negative number`);
  }
  return value;
}

function parseNumberFromTargets(value: unknown, fallback: number) {
  if (value === undefined || value === null || value === "") return fallback;
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return fallback;
  return value;
}

function parseMetrics(role: OpsPulseRole, metrics: unknown) {
  if (!metrics || typeof metrics !== "object") {
    throw new OpsPulseValidationError("metrics is required");
  }

  if (role === "PAGE") {
    const source = metrics as Record<string, unknown>;
    return {
      openMessages: toNonNegativeNumber(source.openMessages ?? 0, "metrics.openMessages"),
      newData: toNonNegativeNumber(source.newData ?? 0, "metrics.newData"),
    } satisfies PageMetrics;
  }

  const source = metrics as Record<string, unknown>;
  return {
    data: toNonNegativeNumber(source.data ?? 0, "metrics.data"),
    called: toNonNegativeNumber(source.called ?? 0, "metrics.called"),
    appointed: toNonNegativeNumber(source.appointed ?? 0, "metrics.appointed"),
    arrived: toNonNegativeNumber(source.arrived ?? 0, "metrics.arrived"),
    signed: toNonNegativeNumber(source.signed ?? 0, "metrics.signed"),
  } satisfies TelesalesMetrics;
}

function normalizeTargets(input: unknown) {
  if (!input || typeof input !== "object") return {};
  const entries = Object.entries(input as Record<string, unknown>);
  return Object.fromEntries(entries.filter(([, value]) => typeof value === "number" && Number.isFinite(value) && value >= 0));
}

function computePageSuggestions(metrics: PageMetrics, rawTargets: Record<string, unknown> = {}): OpsPulseComputed {
  const targets: PulseTargets = {
    newData: parseNumberFromTargets(rawTargets.newData, 4),
    openMessagesMax: parseNumberFromTargets(rawTargets.openMessagesMax, 15),
  };

  const gaps = {
    newData: Math.max(0, targets.newData - metrics.newData),
    openMessages: Math.max(0, metrics.openMessages - targets.openMessagesMax),
  };

  let status: OpsStatus = "OK";
  if (metrics.openMessages >= 30 || (gaps.openMessages >= 10 && gaps.newData > 0)) {
    status = "CRITICAL";
  } else if (gaps.openMessages > 0 || gaps.newData > 0) {
    status = "WARNING";
  }

  const suggestions: string[] = [];
  if (gaps.openMessages > 0) {
    suggestions.push(`Ưu tiên xử lý ${Math.ceil(gaps.openMessages)} hội thoại đang chờ trong 10 phút tới.`);
  }
  if (gaps.newData > 0) {
    suggestions.push(`Cần bổ sung thêm ${Math.ceil(gaps.newData)} data mới để đạt nhịp mục tiêu.`);
  }
  if (metrics.openMessages > 0 && metrics.newData <= 0) {
    suggestions.push("Giảm backlog bằng cách chốt nhanh hội thoại có tín hiệu cao trước.");
  }
  if (suggestions.length === 0) {
    suggestions.push("Nhịp Trực Page đang ổn. Duy trì phản hồi nhanh và cập nhật data đều.");
  }

  return {
    role: "PAGE",
    status,
    metrics,
    targets,
    gaps,
    checklist: suggestions,
    suggestions,
    generatedAt: new Date().toISOString(),
  };
}

function computeTelesalesSuggestions(metrics: TelesalesMetrics, rawTargets: Record<string, unknown> = {}): OpsPulseComputed {
  const targets: PulseTargets = {
    data: parseNumberFromTargets(rawTargets.data, 4),
    called: parseNumberFromTargets(rawTargets.called, 0),
    appointed: parseNumberFromTargets(rawTargets.appointed, 4),
    arrived: parseNumberFromTargets(rawTargets.arrived, 0),
    signed: parseNumberFromTargets(rawTargets.signed, 0),
  };

  const gaps = {
    data: Math.max(0, targets.data - metrics.data),
    called: Math.max(0, targets.called - metrics.called),
    appointed: Math.max(0, targets.appointed - metrics.appointed),
    arrived: Math.max(0, targets.arrived - metrics.arrived),
    signed: Math.max(0, targets.signed - metrics.signed),
  };

  const totalGap = Object.values(gaps).reduce((sum, value) => sum + value, 0);
  const criticalCond = gaps.signed > 0 || gaps.appointed >= 2 || (metrics.data > 0 && metrics.called === 0);
  let status: OpsStatus = "OK";
  if (criticalCond || totalGap >= 5) {
    status = "CRITICAL";
  } else if (totalGap > 0) {
    status = "WARNING";
  }

  const suggestions: string[] = [];
  if (gaps.data > 0) suggestions.push(`Cần xử lý thêm ${Math.ceil(gaps.data)} data mới để đủ đầu vào.`);
  if (gaps.called > 0) suggestions.push(`Thiếu ${Math.ceil(gaps.called)} cuộc gọi so với mục tiêu hiện tại.`);
  if (gaps.appointed > 0) suggestions.push(`Cần chốt thêm ${Math.ceil(gaps.appointed)} lịch hẹn ngay trong ca.`);
  if (gaps.arrived > 0) suggestions.push(`Theo dõi nhắc hẹn để tăng thêm ${Math.ceil(gaps.arrived)} lượt đến.`);
  if (gaps.signed > 0) suggestions.push(`Ưu tiên deal nóng để bổ sung ${Math.ceil(gaps.signed)} ca ghi danh.`);
  if (suggestions.length === 0) {
    suggestions.push("Hiệu suất telesales đang đạt mục tiêu. Duy trì follow-up đúng nhịp.");
  }

  return {
    role: "TELESALES",
    status,
    metrics,
    targets,
    gaps,
    checklist: suggestions,
    suggestions,
    generatedAt: new Date().toISOString(),
  };
}

export function normalizeOpsPulseInput(raw: unknown): OpsPulseInput {
  if (!raw || typeof raw !== "object") throw new OpsPulseValidationError("Invalid JSON body");
  const payload = raw as Record<string, unknown>;
  const role = payload.role;
  if (role !== "PAGE" && role !== "TELESALES") {
    throw new OpsPulseValidationError("role must be PAGE or TELESALES");
  }

  const ownerId = typeof payload.ownerId === "string" && payload.ownerId.trim() ? payload.ownerId.trim() : undefined;
  const branchId = typeof payload.branchId === "string" && payload.branchId.trim() ? payload.branchId.trim() : undefined;
  if (role === "TELESALES" && !ownerId) {
    throw new OpsPulseValidationError("ownerId is required for TELESALES role");
  }

  return {
    role,
    ownerId,
    branchId,
    dateKey: parseDateKey(payload.dateKey),
    windowMinutes: parseWindowMinutes(payload.windowMinutes),
    metrics: payload.metrics as Record<string, unknown>,
    targets: normalizeTargets(payload.targets),
  };
}

export function computeOpsPulse(input: OpsPulseInput): OpsPulseComputed {
  const metrics = parseMetrics(input.role, input.metrics);
  if (input.role === "PAGE") {
    return computePageSuggestions(metrics as PageMetrics, input.targets);
  }
  return computeTelesalesSuggestions(metrics as TelesalesMetrics, input.targets);
}

function floorToWindow(date: Date, windowMinutes: number) {
  const windowMs = windowMinutes * 60 * 1000;
  return new Date(Math.floor(date.getTime() / windowMs) * windowMs);
}

export async function ingestOpsPulse(inputRaw: unknown) {
  const input = normalizeOpsPulseInput(inputRaw);

  if (input.ownerId) {
    const owner = await prisma.user.findUnique({ where: { id: input.ownerId }, select: { id: true } });
    if (!owner) throw new OpsPulseValidationError("ownerId not found");
  }
  if (input.branchId) {
    const branch = await prisma.branch.findUnique({ where: { id: input.branchId }, select: { id: true } });
    if (!branch) throw new OpsPulseValidationError("branchId not found");
  }

  const computed = computeOpsPulse(input);
  const now = new Date();
  const start = floorToWindow(now, input.windowMinutes);
  const end = new Date(start.getTime() + input.windowMinutes * 60 * 1000);

  const existing = await prisma.opsPulse.findFirst({
    where: {
      role: input.role,
      ownerId: input.ownerId ?? null,
      branchId: input.branchId ?? null,
      dateKey: input.dateKey,
      windowMinutes: input.windowMinutes,
      createdAt: {
        gte: start,
        lt: end,
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const payloadJson = JSON.parse(
    JSON.stringify({
      metrics: input.metrics,
      targets: input.targets ?? {},
    })
  ) as Prisma.InputJsonValue;
  const computedJson = JSON.parse(JSON.stringify(computed)) as Prisma.InputJsonValue;

  const data = {
    role: input.role,
    ownerId: input.ownerId ?? null,
    branchId: input.branchId ?? null,
    dateKey: input.dateKey,
    windowMinutes: input.windowMinutes,
    payloadJson,
    computedJson,
  };

  const row = existing
    ? await prisma.opsPulse.update({ where: { id: existing.id }, data })
    : await prisma.opsPulse.create({ data });

  return {
    id: row.id,
    status: computed.status,
    computedJson: computed,
  };
}

export async function listOpsPulse(params: {
  role?: OpsPulseRole;
  ownerId?: string;
  dateKey?: string;
  limit?: number;
}) {
  const take = Math.min(Math.max(1, params.limit ?? 50), 200);
  const where: Prisma.OpsPulseWhereInput = {
    ...(params.role ? { role: params.role } : {}),
    ...(params.ownerId ? { ownerId: params.ownerId } : {}),
    ...(params.dateKey ? { dateKey: params.dateKey } : {}),
  };

  const items = await prisma.opsPulse.findMany({
    where,
    include: {
      owner: { select: { id: true, name: true, email: true } },
      branch: { select: { id: true, name: true, code: true } },
    },
    orderBy: { createdAt: "desc" },
    take,
  });

  const statusCounts: Record<OpsStatus, number> = { OK: 0, WARNING: 0, CRITICAL: 0 };
  const latestByRole: Partial<Record<OpsPulseRole, (typeof items)[number]>> = {};

  for (const item of items) {
    const status = ((item.computedJson as { status?: OpsStatus })?.status ?? "WARNING") as OpsStatus;
    if (statusCounts[status] !== undefined) statusCounts[status] += 1;
    if (!latestByRole[item.role]) {
      latestByRole[item.role] = item;
    }
  }

  return {
    items,
    aggregate: {
      total: items.length,
      statusCounts,
      latestByRole,
    },
  };
}
