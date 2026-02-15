import type { EmployeeKpiRole, OpsPulseRole, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getKpiTargetsForUser } from "@/lib/services/employee-kpi";

export type OpsStatus = "OK" | "WARNING" | "CRITICAL";

type PageMetrics = {
  messagesToday: number;
  dataToday: number;
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
  adminScope?: boolean;
  branchId?: string;
  dateKey: string;
  windowMinutes: number;
  metrics: Record<string, unknown>;
  targets?: Record<string, unknown>;
};

type TargetSource = "user_setting" | "payload" | "default";

export type OpsPulseComputed = {
  role: OpsPulseRole;
  status: OpsStatus;
  metrics: PageMetrics | TelesalesMetrics;
  targets: PulseTargets;
  resolvedTargets: PulseTargets;
  targetSource: TargetSource;
  gaps: Record<string, number>;
  checklist: string[];
  suggestions: string[];
  generatedAt: string;
  daily?: {
    messagesToday: number;
    dataToday: number;
    dataRatePctDaily: number;
  };
  target?: {
    dataRatePctTarget: number;
  };
  gap?: {
    dataRatePct: number;
  };
  period?: {
    type: "MTD";
    monthStartISO: string;
    nowISO: string;
    tz: string;
  };
  mtd?: {
    data: number;
    called: number;
    appointed: number;
    arrived: number;
    signed: number;
  };
  ratesGlobal?: {
    calledPctGlobalActual: number | null;
    appointedPctGlobalActual: number | null;
    arrivedPctGlobalActual: number | null;
    signedPctGlobalActual: number | null;
  };
  ratesGlobalActual?: {
    calledPctGlobalActual: number | null;
    appointedPctGlobalActual: number | null;
    arrivedPctGlobalActual: number | null;
    signedPctGlobalActual: number | null;
  };
  ratesGlobalTarget?: {
    calledPctGlobal?: number;
    appointedPctGlobal?: number;
    arrivedPctGlobal?: number;
    signedPctGlobal?: number;
  };
};

export class OpsPulseValidationError extends Error {}

const OPS_TZ = process.env.OPS_TZ?.trim() || "Asia/Ho_Chi_Minh";

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

function toNonNegativeInt(value: unknown, field: string) {
  if (typeof value !== "number" || !Number.isFinite(value) || !Number.isInteger(value) || value < 0) {
    throw new OpsPulseValidationError(`${field} must be an integer >= 0`);
  }
  return value;
}

function parseNumberFromTargets(value: unknown, fallback: number) {
  if (value === undefined || value === null || value === "") return fallback;
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return fallback;
  return Math.round(value);
}

function parsePercentFromTargets(value: unknown) {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  const rounded = Math.round(value * 10) / 10;
  if (rounded < 0 || rounded > 100) return undefined;
  return rounded;
}

function parseMetrics(role: OpsPulseRole, metrics: unknown) {
  if (!metrics || typeof metrics !== "object") {
    throw new OpsPulseValidationError("metrics is required");
  }

  const source = metrics as Record<string, unknown>;
  if (role === "PAGE") {
    if (source.messagesToday === undefined || source.dataToday === undefined) {
      throw new OpsPulseValidationError("PAGE requires metrics.messagesToday and metrics.dataToday");
    }
    return {
      messagesToday: toNonNegativeInt(source.messagesToday, "metrics.messagesToday"),
      dataToday: toNonNegativeInt(source.dataToday, "metrics.dataToday"),
    } satisfies PageMetrics;
  }

  if (
    source.dataToday === undefined ||
    source.calledToday === undefined ||
    source.appointedToday === undefined ||
    source.arrivedToday === undefined ||
    source.signedToday === undefined
  ) {
    throw new OpsPulseValidationError(
      "TELESALES requires metrics.dataToday/calledToday/appointedToday/arrivedToday/signedToday"
    );
  }

  return {
    data: toNonNegativeInt(source.dataToday, "metrics.dataToday"),
    called: toNonNegativeInt(source.calledToday, "metrics.calledToday"),
    appointed: toNonNegativeInt(source.appointedToday, "metrics.appointedToday"),
    arrived: toNonNegativeInt(source.arrivedToday, "metrics.arrivedToday"),
    signed: toNonNegativeInt(source.signedToday, "metrics.signedToday"),
  } satisfies TelesalesMetrics;
}

function normalizeTargets(input: unknown) {
  if (!input || typeof input !== "object") return {};
  const entries = Object.entries(input as Record<string, unknown>);
  return Object.fromEntries(entries.filter(([, value]) => typeof value === "number" && Number.isFinite(value) && value >= 0));
}

function defaultTargetsForPage(): PulseTargets {
  return {
    dataRatePctTarget: 20,
  };
}

function defaultTargetsForTelesales(): PulseTargets {
  return {
    dataDaily: 4,
    calledDaily: 0,
    appointedDaily: 4,
    arrivedDaily: 0,
    signedDaily: 0,
  };
}

function computePageSuggestions(
  metrics: PageMetrics,
  resolvedTargets: PulseTargets,
  targetSource: TargetSource
): OpsPulseComputed {
  const dataRatePctTarget = parsePercentFromTargets(resolvedTargets.dataRatePctTarget) ?? 20;
  const dataRatePctDaily =
    metrics.messagesToday > 0 ? Math.round((metrics.dataToday / metrics.messagesToday) * 1000) / 10 : 0;
  const dataRateGap = Math.max(0, Math.round((dataRatePctTarget - dataRatePctDaily) * 10) / 10);

  const targets: PulseTargets = { dataRatePctTarget };
  const gaps = { dataRatePct: dataRateGap };

  let status: OpsStatus = "OK";
  if (metrics.dataToday === 0 && metrics.messagesToday > 0) {
    status = "CRITICAL";
  } else if (dataRatePctDaily >= dataRatePctTarget) {
    status = "OK";
  } else if (dataRatePctDaily >= dataRatePctTarget * 0.8) {
    status = "WARNING";
  } else {
    status = "CRITICAL";
  }

  const suggestions: string[] = [];
  if (status !== "OK") {
    suggestions.push("Ưu tiên hội thoại mới trong 5 phút đầu để tăng tốc độ chuyển đổi.");
    suggestions.push("Lọc lại hội thoại nóng và nhắc đội chốt thông tin thiếu ngay trong lượt đầu.");
    suggestions.push("Dùng mẫu hỏi ngắn để xác thực nhu cầu rồi đẩy form Data ngay.");
    suggestions.push("Rà soát ca trực: phân người theo nhóm hội thoại chưa phản hồi quá 10 phút.");
    suggestions.push("Cuối mỗi 30 phút chốt lại tỷ lệ % ra Data và điều chỉnh kịch bản phản hồi.");
  } else {
    suggestions.push("Tỷ lệ ra Data trong ngày đang đạt mục tiêu. Duy trì nhịp phản hồi và chuẩn hóa kịch bản.");
  }

  return {
    role: "PAGE",
    status,
    metrics,
    targets,
    resolvedTargets: targets,
    targetSource,
    gaps,
    checklist: suggestions,
    suggestions,
    generatedAt: new Date().toISOString(),
    daily: {
      messagesToday: metrics.messagesToday,
      dataToday: metrics.dataToday,
      dataRatePctDaily,
    },
    target: {
      dataRatePctTarget,
    },
    gap: {
      dataRatePct: dataRateGap,
    },
  };
}

function hcmMonthWindow(dateKey: string) {
  const [year, month] = dateKey.split("-");
  const monthStart = new Date(`${year}-${month}-01T00:00:00.000+07:00`);

  const currentHcmMonth = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
  }).format(new Date());
  const inputMonth = `${year}-${month}`;

  const periodEnd = inputMonth === currentHcmMonth ? new Date() : new Date(`${dateKey}T23:59:59.999+07:00`);
  return { monthStart, periodEnd };
}

type TelesalesMtd = {
  data: number;
  called: number;
  appointed: number;
  arrived: number;
  signed: number;
  monthStartISO: string;
  nowISO: string;
};

async function getTelesalesMtd(ownerId: string, dateKey: string): Promise<TelesalesMtd> {
  const { monthStart, periodEnd } = hcmMonthWindow(dateKey);
  const range = { gte: monthStart, lte: periodEnd };

  const [data, called, appointed, arrived, signed] = await Promise.all([
    prisma.leadEvent.count({ where: { type: "HAS_PHONE", createdAt: range, lead: { ownerId } } }),
    prisma.leadEvent.count({ where: { type: "CALLED", createdAt: range, lead: { ownerId } } }),
    prisma.leadEvent.count({ where: { type: "APPOINTED", createdAt: range, lead: { ownerId } } }),
    prisma.leadEvent.count({ where: { type: "ARRIVED", createdAt: range, lead: { ownerId } } }),
    prisma.leadEvent.count({ where: { type: "SIGNED", createdAt: range, lead: { ownerId } } }),
  ]);

  return {
    data,
    called,
    appointed,
    arrived,
    signed,
    monthStartISO: monthStart.toISOString(),
    nowISO: periodEnd.toISOString(),
  };
}

function toRate(numerator: number, denominator: number) {
  if (denominator <= 0) return null;
  return Math.round((numerator / denominator) * 10000) / 100;
}

async function computeTelesalesSuggestions(
  input: OpsPulseInput,
  metrics: TelesalesMetrics,
  resolvedTargets: PulseTargets,
  targetSource: TargetSource
): Promise<OpsPulseComputed> {
  const targets: PulseTargets = {
    dataDaily: parseNumberFromTargets(resolvedTargets.dataDaily ?? resolvedTargets.data, 4),
    calledDaily: parseNumberFromTargets(resolvedTargets.calledDaily ?? resolvedTargets.called, 0),
    appointedDaily: parseNumberFromTargets(resolvedTargets.appointedDaily ?? resolvedTargets.appointed, 4),
    arrivedDaily: parseNumberFromTargets(resolvedTargets.arrivedDaily ?? resolvedTargets.arrived, 0),
    signedDaily: parseNumberFromTargets(resolvedTargets.signedDaily ?? resolvedTargets.signed, 0),
    ...(parsePercentFromTargets(resolvedTargets.calledPctGlobal) !== undefined
      ? { calledPctGlobal: parsePercentFromTargets(resolvedTargets.calledPctGlobal) as number }
      : {}),
    ...(parsePercentFromTargets(resolvedTargets.appointedPctGlobal) !== undefined
      ? { appointedPctGlobal: parsePercentFromTargets(resolvedTargets.appointedPctGlobal) as number }
      : {}),
    ...(parsePercentFromTargets(resolvedTargets.arrivedPctGlobal) !== undefined
      ? { arrivedPctGlobal: parsePercentFromTargets(resolvedTargets.arrivedPctGlobal) as number }
      : {}),
    ...(parsePercentFromTargets(resolvedTargets.signedPctGlobal) !== undefined
      ? { signedPctGlobal: parsePercentFromTargets(resolvedTargets.signedPctGlobal) as number }
      : {}),
  };

  const mtd = await getTelesalesMtd(input.ownerId as string, input.dateKey);

  const ratesGlobal = {
    calledPctGlobalActual: toRate(mtd.called, mtd.data),
    appointedPctGlobalActual: toRate(mtd.appointed, mtd.data),
    arrivedPctGlobalActual: toRate(mtd.arrived, mtd.data),
    signedPctGlobalActual: toRate(mtd.signed, mtd.data),
  };

  const ratesGlobalTarget = {
    ...(targets.calledPctGlobal !== undefined ? { calledPctGlobal: targets.calledPctGlobal } : {}),
    ...(targets.appointedPctGlobal !== undefined ? { appointedPctGlobal: targets.appointedPctGlobal } : {}),
    ...(targets.arrivedPctGlobal !== undefined ? { arrivedPctGlobal: targets.arrivedPctGlobal } : {}),
    ...(targets.signedPctGlobal !== undefined ? { signedPctGlobal: targets.signedPctGlobal } : {}),
  };

  const hasPctTargets = Object.keys(ratesGlobalTarget).length > 0;

  const gaps: Record<string, number> = {
    dataDaily: Math.max(0, targets.dataDaily - metrics.data),
    calledDaily: Math.max(0, targets.calledDaily - metrics.called),
    appointedDaily: Math.max(0, targets.appointedDaily - metrics.appointed),
    arrivedDaily: Math.max(0, targets.arrivedDaily - metrics.arrived),
    signedDaily: Math.max(0, targets.signedDaily - metrics.signed),
  };

  if (ratesGlobalTarget.calledPctGlobal !== undefined) {
    gaps.calledPctGlobal = Math.max(0, ratesGlobalTarget.calledPctGlobal - (ratesGlobal.calledPctGlobalActual ?? 0));
  }
  if (ratesGlobalTarget.appointedPctGlobal !== undefined) {
    gaps.appointedPctGlobal = Math.max(
      0,
      ratesGlobalTarget.appointedPctGlobal - (ratesGlobal.appointedPctGlobalActual ?? 0)
    );
  }
  if (ratesGlobalTarget.arrivedPctGlobal !== undefined) {
    gaps.arrivedPctGlobal = Math.max(0, ratesGlobalTarget.arrivedPctGlobal - (ratesGlobal.arrivedPctGlobalActual ?? 0));
  }
  if (ratesGlobalTarget.signedPctGlobal !== undefined) {
    gaps.signedPctGlobal = Math.max(0, ratesGlobalTarget.signedPctGlobal - (ratesGlobal.signedPctGlobalActual ?? 0));
  }

  let status: OpsStatus = "OK";
  const suggestions: string[] = [];

  if (hasPctTargets) {
    const pctGaps = [gaps.calledPctGlobal, gaps.appointedPctGlobal, gaps.arrivedPctGlobal, gaps.signedPctGlobal]
      .filter((value) => typeof value === "number") as number[];

    const maxPctGap = pctGaps.length > 0 ? Math.max(...pctGaps) : 0;

    if (mtd.data <= 0) {
      status = "CRITICAL";
      suggestions.push("Chưa có Data MTD. Ưu tiên tạo data mới và xử lý hội thoại đầu vào.");
    } else if (maxPctGap >= 20) {
      status = "CRITICAL";
    } else if (maxPctGap > 0) {
      status = "WARNING";
    }

    if ((gaps.calledPctGlobal ?? 0) > 0) {
      suggestions.push("Tỷ lệ gọi/Data đang thấp. Ưu tiên gọi lại data cũ, lọc data nóng và follow-up trong khung giờ vàng.");
    }
    if ((gaps.appointedPctGlobal ?? 0) > 0) {
      suggestions.push("Tỷ lệ hẹn/Data chưa đạt. Tối ưu script chốt lịch, nhắc ưu đãi và chốt next step ngay trong cuộc gọi.");
    }
    if ((gaps.arrivedPctGlobal ?? 0) > 0) {
      suggestions.push("Tỷ lệ đến/Data thấp. Nhắc lịch 2 lần, xác nhận giấy tờ và gửi map/checklist trước giờ hẹn.");
    }
    if ((gaps.signedPctGlobal ?? 0) > 0) {
      suggestions.push("Tỷ lệ ký/Data thấp. Tập trung xử lý objection, chốt cọc/đóng 50% và cam kết timeline thi rõ ràng.");
    }

    if (suggestions.length === 0) {
      suggestions.push("KPI % MTD đang đạt mục tiêu. Duy trì nhịp follow-up và chất lượng data đầu vào.");
    }
  } else {
    const totalGap = [gaps.dataDaily, gaps.calledDaily, gaps.appointedDaily, gaps.arrivedDaily, gaps.signedDaily].reduce(
      (sum, value) => sum + value,
      0
    );
    const criticalCond =
      gaps.signedDaily > 0 || gaps.appointedDaily >= 2 || (metrics.data > 0 && metrics.called === 0);
    if (criticalCond || totalGap >= 5) {
      status = "CRITICAL";
    } else if (totalGap > 0) {
      status = "WARNING";
    }

    if (gaps.dataDaily > 0) suggestions.push(`Cần xử lý thêm ${Math.ceil(gaps.dataDaily)} data mới để đủ đầu vào.`);
    if (gaps.calledDaily > 0) suggestions.push(`Thiếu ${Math.ceil(gaps.calledDaily)} cuộc gọi so với mục tiêu hiện tại.`);
    if (gaps.appointedDaily > 0) suggestions.push(`Cần chốt thêm ${Math.ceil(gaps.appointedDaily)} lịch hẹn ngay trong ca.`);
    if (gaps.arrivedDaily > 0) suggestions.push(`Theo dõi nhắc hẹn để tăng thêm ${Math.ceil(gaps.arrivedDaily)} lượt đến.`);
    if (gaps.signedDaily > 0) suggestions.push(`Ưu tiên deal nóng để bổ sung ${Math.ceil(gaps.signedDaily)} ca ghi danh.`);
    if (suggestions.length === 0) {
      suggestions.push("Hiệu suất telesales đang đạt mục tiêu. Duy trì follow-up đúng nhịp.");
    }
  }

  return {
    role: "TELESALES",
    status,
    metrics,
    targets,
    resolvedTargets: targets,
    targetSource,
    gaps,
    checklist: suggestions,
    suggestions,
    generatedAt: new Date().toISOString(),
    period: {
      type: "MTD",
      monthStartISO: mtd.monthStartISO,
      nowISO: mtd.nowISO,
      tz: OPS_TZ,
    },
    mtd: {
      data: mtd.data,
      called: mtd.called,
      appointed: mtd.appointed,
      arrived: mtd.arrived,
      signed: mtd.signed,
    },
    ratesGlobal,
    ratesGlobalActual: ratesGlobal,
    ratesGlobalTarget,
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
  const adminScope = payload.adminScope === true;
  const branchId = typeof payload.branchId === "string" && payload.branchId.trim() ? payload.branchId.trim() : undefined;
  if (!ownerId && !adminScope) {
    throw new OpsPulseValidationError("ownerId is required unless adminScope=true");
  }
  if (role === "TELESALES" && !ownerId && adminScope) {
    throw new OpsPulseValidationError("TELESALES requires ownerId");
  }

  return {
    role,
    ownerId,
    adminScope,
    branchId,
    dateKey: parseDateKey(payload.dateKey),
    windowMinutes: parseWindowMinutes(payload.windowMinutes),
    metrics: payload.metrics as Record<string, unknown>,
    targets: normalizeTargets(payload.targets),
  };
}

export async function computeOpsPulse(
  input: OpsPulseInput,
  resolvedTargets: PulseTargets,
  targetSource: TargetSource
): Promise<OpsPulseComputed> {
  const metrics = parseMetrics(input.role, input.metrics);
  if (input.role === "PAGE") {
    return computePageSuggestions(metrics as PageMetrics, resolvedTargets, targetSource);
  }
  return computeTelesalesSuggestions(input, metrics as TelesalesMetrics, resolvedTargets, targetSource);
}

function floorToWindow(date: Date, windowMinutes: number) {
  const windowMs = windowMinutes * 60 * 1000;
  return new Date(Math.floor(date.getTime() / windowMs) * windowMs);
}

async function resolveTargets(input: OpsPulseInput): Promise<{
  targets: PulseTargets;
  source: TargetSource;
}> {
  if (input.ownerId) {
    const settingTargets = await getKpiTargetsForUser({
      userId: input.ownerId,
      role: input.role as EmployeeKpiRole,
      dateKey: input.dateKey,
    });
    if (settingTargets) {
      if (input.role === "PAGE") {
        return {
          targets: {
            dataRatePctTarget:
              parsePercentFromTargets(settingTargets.dataRatePctTarget) ??
              parsePercentFromTargets(settingTargets.dataDaily) ??
              20,
          },
          source: "user_setting",
        };
      }

      return {
        targets: {
          dataDaily: parseNumberFromTargets(settingTargets.dataDaily ?? settingTargets.data, 4),
          calledDaily: parseNumberFromTargets(settingTargets.calledDaily ?? settingTargets.called, 0),
          appointedDaily: parseNumberFromTargets(settingTargets.appointedDaily ?? settingTargets.appointed, 4),
          arrivedDaily: parseNumberFromTargets(settingTargets.arrivedDaily ?? settingTargets.arrived, 0),
          signedDaily: parseNumberFromTargets(settingTargets.signedDaily ?? settingTargets.signed, 0),
          ...(parsePercentFromTargets(settingTargets.calledPctGlobal) !== undefined
            ? { calledPctGlobal: parsePercentFromTargets(settingTargets.calledPctGlobal) as number }
            : {}),
          ...(parsePercentFromTargets(settingTargets.appointedPctGlobal) !== undefined
            ? { appointedPctGlobal: parsePercentFromTargets(settingTargets.appointedPctGlobal) as number }
            : {}),
          ...(parsePercentFromTargets(settingTargets.arrivedPctGlobal) !== undefined
            ? { arrivedPctGlobal: parsePercentFromTargets(settingTargets.arrivedPctGlobal) as number }
            : {}),
          ...(parsePercentFromTargets(settingTargets.signedPctGlobal) !== undefined
            ? { signedPctGlobal: parsePercentFromTargets(settingTargets.signedPctGlobal) as number }
            : {}),
        },
        source: "user_setting",
      };
    }
  }

  if (input.targets && Object.keys(input.targets).length > 0) {
    if (input.role === "PAGE") {
      return {
        targets: {
          dataRatePctTarget:
            parsePercentFromTargets(input.targets.dataRatePctTarget) ??
            parsePercentFromTargets(input.targets.newData) ??
            20,
        },
        source: "payload",
      };
    }
    return {
      targets: {
        dataDaily: parseNumberFromTargets(input.targets.dataDaily ?? input.targets.data, 4),
        calledDaily: parseNumberFromTargets(input.targets.calledDaily ?? input.targets.called, 0),
        appointedDaily: parseNumberFromTargets(input.targets.appointedDaily ?? input.targets.appointed, 4),
        arrivedDaily: parseNumberFromTargets(input.targets.arrivedDaily ?? input.targets.arrived, 0),
        signedDaily: parseNumberFromTargets(input.targets.signedDaily ?? input.targets.signed, 0),
        ...(parsePercentFromTargets(input.targets.calledPctGlobal) !== undefined
          ? { calledPctGlobal: parsePercentFromTargets(input.targets.calledPctGlobal) as number }
          : {}),
        ...(parsePercentFromTargets(input.targets.appointedPctGlobal) !== undefined
          ? { appointedPctGlobal: parsePercentFromTargets(input.targets.appointedPctGlobal) as number }
          : {}),
        ...(parsePercentFromTargets(input.targets.arrivedPctGlobal) !== undefined
          ? { arrivedPctGlobal: parsePercentFromTargets(input.targets.arrivedPctGlobal) as number }
          : {}),
        ...(parsePercentFromTargets(input.targets.signedPctGlobal) !== undefined
          ? { signedPctGlobal: parsePercentFromTargets(input.targets.signedPctGlobal) as number }
          : {}),
      },
      source: "payload",
    };
  }

  return {
    targets: input.role === "PAGE" ? defaultTargetsForPage() : defaultTargetsForTelesales(),
    source: "default",
  };
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

  const targetResolution = await resolveTargets(input);
  const computed = await computeOpsPulse(input, targetResolution.targets, targetResolution.source);
  const now = new Date();
  const bucketStart = floorToWindow(now, input.windowMinutes);
  const ownerScopeKey = input.ownerId ?? "";
  const branchScopeKey = input.branchId ?? "";

  const payloadJson = JSON.parse(
    JSON.stringify({
      metrics: input.metrics,
      targets: input.targets ?? {},
      resolvedTargets: targetResolution.targets,
      targetSource: targetResolution.source,
    })
  ) as Prisma.InputJsonValue;
  const computedJson = JSON.parse(JSON.stringify(computed)) as Prisma.InputJsonValue;

  const data = {
    role: input.role,
    ownerId: input.ownerId ?? null,
    ownerScopeKey,
    branchId: input.branchId ?? null,
    branchScopeKey,
    dateKey: input.dateKey,
    windowMinutes: input.windowMinutes,
    bucketStart,
    payloadJson,
    computedJson,
  };

  const row = await prisma.opsPulse.upsert({
    where: {
      role_dateKey_windowMinutes_bucketStart_ownerScopeKey_branchScopeKey: {
        role: input.role,
        dateKey: input.dateKey,
        windowMinutes: input.windowMinutes,
        bucketStart,
        ownerScopeKey,
        branchScopeKey,
      },
    },
    update: data,
    create: data,
  });

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
