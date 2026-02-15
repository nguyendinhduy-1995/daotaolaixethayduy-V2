import type { EmployeeKpiRole, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export class EmployeeKpiValidationError extends Error {
  constructor(message: string) {
    super(message);
  }
}

type RawTargets = Record<string, unknown>;

export type EmployeeKpiTargets = Record<string, number>;

export type EmployeeKpiListParams = {
  role?: EmployeeKpiRole;
  userId?: string;
  active?: boolean;
  page?: number;
  pageSize?: number;
};

const PAGE_KEYS = ["dataDaily", "openMessagesMax"] as const;
const TELESALES_ABS_KEYS = [
  "dataDaily",
  "calledDaily",
  "appointedDaily",
  "arrivedDaily",
  "signedDaily",
  "data",
  "called",
  "appointed",
  "arrived",
  "signed",
] as const;
const TELESALES_PCT_KEYS = [
  "calledPctGlobal",
  "appointedPctGlobal",
  "arrivedPctGlobal",
  "signedPctGlobal",
] as const;

function parseYmd(input: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input)) {
    throw new EmployeeKpiValidationError("dateKey must be YYYY-MM-DD");
  }
  const [year, month, day] = input.split("-").map(Number);
  const utc = new Date(Date.UTC(year, month - 1, day));
  if (
    utc.getUTCFullYear() !== year ||
    utc.getUTCMonth() !== month - 1 ||
    utc.getUTCDate() !== day
  ) {
    throw new EmployeeKpiValidationError("dateKey must be YYYY-MM-DD");
  }
  return input;
}

function hcmDayRange(dateKey: string) {
  parseYmd(dateKey);
  const start = new Date(`${dateKey}T00:00:00.000+07:00`);
  const end = new Date(`${dateKey}T23:59:59.999+07:00`);
  return { start, end };
}

function normalizeTargetValue(value: unknown, key: string) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new EmployeeKpiValidationError(`targetsJson.${key} must be a non-negative number`);
  }
  return Math.round(value);
}

function normalizePercentTarget(value: unknown, key: string) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new EmployeeKpiValidationError(`targetsJson.${key} must be a number`);
  }
  const rounded = Math.round(value);
  if (rounded < 0 || rounded > 100) {
    throw new EmployeeKpiValidationError(`targetsJson.${key} must be between 0 and 100`);
  }
  return rounded;
}

function normalizeTargetsRecord(input: unknown) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new EmployeeKpiValidationError("targetsJson must be an object");
  }
  return input as RawTargets;
}

export function validateTargets(role: EmployeeKpiRole, targetsInput: unknown): EmployeeKpiTargets {
  const raw = normalizeTargetsRecord(targetsInput);

  if (role === "PAGE") {
    if (raw.dataDaily === undefined) {
      throw new EmployeeKpiValidationError("PAGE targetsJson requires dataDaily");
    }
    const normalized: EmployeeKpiTargets = {
      dataDaily: normalizeTargetValue(raw.dataDaily, "dataDaily"),
    };

    if (raw.openMessagesMax !== undefined) {
      normalized.openMessagesMax = normalizeTargetValue(raw.openMessagesMax, "openMessagesMax");
    }

    for (const [key, value] of Object.entries(raw)) {
      if (![...PAGE_KEYS].includes(key as (typeof PAGE_KEYS)[number])) {
        continue;
      }
      normalized[key] = normalizeTargetValue(value, key);
    }

    return normalized;
  }

  const normalized: EmployeeKpiTargets = {};
  let presentAbs = 0;
  let presentPct = 0;

  for (const key of TELESALES_ABS_KEYS) {
    if (raw[key] !== undefined) {
      normalized[key] = normalizeTargetValue(raw[key], key);
      presentAbs += 1;
    }
  }
  for (const key of TELESALES_PCT_KEYS) {
    if (raw[key] !== undefined) {
      normalized[key] = normalizePercentTarget(raw[key], key);
      presentPct += 1;
    }
  }

  if (presentAbs === 0 && presentPct === 0) {
    throw new EmployeeKpiValidationError(
      "TELESALES targetsJson requires at least one abs target or pct target"
    );
  }

  return normalized;
}

export async function getKpiTargetsForUser(params: {
  userId: string;
  role: EmployeeKpiRole;
  dateKey: string;
}) {
  const { start, end } = hcmDayRange(params.dateKey);

  const setting = await prisma.employeeKpiSetting.findFirst({
    where: {
      userId: params.userId,
      role: params.role,
      isActive: true,
      effectiveFrom: { lte: end },
      OR: [{ effectiveTo: null }, { effectiveTo: { gte: start } }],
    },
    orderBy: [{ effectiveFrom: "desc" }, { createdAt: "desc" }],
  });

  if (!setting) return null;

  return validateTargets(setting.role, setting.targetsJson as unknown);
}

function normalizePage(page?: number) {
  if (!Number.isInteger(page) || (page as number) <= 0) return 1;
  return page as number;
}

function normalizePageSize(pageSize?: number) {
  if (!Number.isInteger(pageSize) || (pageSize as number) <= 0) return 20;
  return Math.min(pageSize as number, 100);
}

export async function listSettings(params: EmployeeKpiListParams) {
  const page = normalizePage(params.page);
  const pageSize = normalizePageSize(params.pageSize);

  const where: Prisma.EmployeeKpiSettingWhereInput = {
    ...(params.role ? { role: params.role } : {}),
    ...(params.userId ? { userId: params.userId } : {}),
    ...(typeof params.active === "boolean" ? { isActive: params.active } : {}),
  };

  const [items, total] = await Promise.all([
    prisma.employeeKpiSetting.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            isActive: true,
          },
        },
      },
      orderBy: [{ effectiveFrom: "desc" }, { createdAt: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.employeeKpiSetting.count({ where }),
  ]);

  return { items, page, pageSize, total };
}

function parseDateField(value: unknown, field: string) {
  if (typeof value !== "string" || !value.trim()) {
    throw new EmployeeKpiValidationError(`${field} is required`);
  }
  parseYmd(value);
  return new Date(`${value}T00:00:00.000+07:00`);
}

function optionalDateField(value: unknown, field: string) {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  if (typeof value !== "string") {
    throw new EmployeeKpiValidationError(`${field} must be YYYY-MM-DD`);
  }
  parseYmd(value);
  return new Date(`${value}T23:59:59.999+07:00`);
}

export async function createSetting(input: {
  userId: string;
  role: EmployeeKpiRole;
  effectiveFrom: string;
  effectiveTo?: string | null;
  targetsJson: unknown;
  isActive?: boolean;
}) {
  const user = await prisma.user.findUnique({ where: { id: input.userId }, select: { id: true } });
  if (!user) throw new EmployeeKpiValidationError("userId not found");

  const effectiveFrom = parseDateField(input.effectiveFrom, "effectiveFrom");
  const effectiveTo = optionalDateField(input.effectiveTo, "effectiveTo");
  if (effectiveTo && effectiveTo.getTime() < effectiveFrom.getTime()) {
    throw new EmployeeKpiValidationError("effectiveTo must be after effectiveFrom");
  }

  const targets = validateTargets(input.role, input.targetsJson);

  return prisma.employeeKpiSetting.create({
    data: {
      userId: input.userId,
      role: input.role,
      effectiveFrom,
      effectiveTo,
      targetsJson: JSON.parse(JSON.stringify(targets)) as Prisma.InputJsonValue,
      isActive: input.isActive ?? true,
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          isActive: true,
        },
      },
    },
  });
}

export async function updateSetting(
  id: string,
  input: {
    role?: EmployeeKpiRole;
    effectiveFrom?: string;
    effectiveTo?: string | null;
    targetsJson?: unknown;
    isActive?: boolean;
  }
) {
  const existing = await prisma.employeeKpiSetting.findUnique({ where: { id } });
  if (!existing) throw new EmployeeKpiValidationError("Setting not found");

  const role = input.role ?? existing.role;
  const effectiveFrom =
    input.effectiveFrom !== undefined
      ? parseDateField(input.effectiveFrom, "effectiveFrom")
      : existing.effectiveFrom;
  const effectiveTo =
    input.effectiveTo !== undefined
      ? optionalDateField(input.effectiveTo, "effectiveTo")
      : existing.effectiveTo;

  if (effectiveTo && effectiveTo.getTime() < effectiveFrom.getTime()) {
    throw new EmployeeKpiValidationError("effectiveTo must be after effectiveFrom");
  }

  const targets =
    input.targetsJson !== undefined
      ? validateTargets(role, input.targetsJson)
      : (validateTargets(role, existing.targetsJson as unknown) as EmployeeKpiTargets);

  return prisma.employeeKpiSetting.update({
    where: { id },
    data: {
      ...(input.role !== undefined ? { role: input.role } : {}),
      ...(input.effectiveFrom !== undefined ? { effectiveFrom } : {}),
      ...(input.effectiveTo !== undefined ? { effectiveTo } : {}),
      ...(input.targetsJson !== undefined
        ? { targetsJson: JSON.parse(JSON.stringify(targets)) as Prisma.InputJsonValue }
        : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          isActive: true,
        },
      },
    },
  });
}
