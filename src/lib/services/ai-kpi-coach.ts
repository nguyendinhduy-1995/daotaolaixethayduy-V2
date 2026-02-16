import crypto from "node:crypto";
import { type AiScoreColor, type GoalPeriodType, OutboundPriority, type OutboundChannel, type Role, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { AuthPayload } from "@/lib/auth";
import { API_ERROR_VI } from "@/lib/api-error-vi";
import { ensureOutboundSchema, renderTemplate } from "@/lib/outbound-db";
import { enforceBranchScope, getAllowedBranchIds, resolveScope, resolveWriteBranchId } from "@/lib/scope";
import { KPI_METRICS_CATALOG, getMetricDef, getMetricLabelVi, isMetricAllowedForRole, roleLabelVi } from "@/lib/kpi-metrics-catalog";

const TARGET_ROLES: Role[] = ["direct_page", "telesales"];
const SUGGESTION_COLORS: AiScoreColor[] = ["RED", "YELLOW", "GREEN"];
const OUTBOUND_CHANNELS: OutboundChannel[] = ["ZALO", "FB", "SMS", "CALL_NOTE"];
const KPI_METRIC_KEYS = KPI_METRICS_CATALOG.map((item) => item.key);

export class AiCoachValidationError extends Error {}
export class AiCoachForbiddenError extends Error {}

function todayInHoChiMinh() {
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

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((v) => stableStringify(v)).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(",")}}`;
}

function hashPayload(value: unknown) {
  return crypto.createHash("sha256").update(stableStringify(value)).digest("hex");
}

function ensureYmd(dateKey: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) throw new AiCoachValidationError("dateKey phải có dạng YYYY-MM-DD");
}

function ensureYm(monthKey: string) {
  if (!/^\d{4}-\d{2}$/.test(monthKey)) throw new AiCoachValidationError("monthKey phải có dạng YYYY-MM");
}

function parseRole(value: unknown, allowAll = false): Role {
  const role = String(value || "").trim() as Role;
  if (allowAll && ["admin", "viewer", "manager", "telesales", "direct_page"].includes(role)) return role;
  if (TARGET_ROLES.includes(role)) return role;
  throw new AiCoachValidationError("Vai trò không hợp lệ");
}

function parseColor(value: unknown): AiScoreColor {
  const color = String(value || "").trim().toUpperCase() as AiScoreColor;
  if (!SUGGESTION_COLORS.includes(color)) throw new AiCoachValidationError("Màu đánh giá không hợp lệ");
  return color;
}

function parseIntNonNegative(value: unknown, fieldName: string) {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0) throw new AiCoachValidationError(`${fieldName} phải là số nguyên không âm`);
  return n;
}

function parsePercentTarget(value: unknown) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0 || n > 100) {
    throw new AiCoachValidationError("Mục tiêu KPI phải nằm trong khoảng 0-100%");
  }
  if (!Number.isInteger(n)) {
    throw new AiCoachValidationError("Mục tiêu KPI phải là số nguyên phần trăm");
  }
  return n;
}

function parseDayOfWeek(value: unknown) {
  if (value === null || value === undefined || value === "") return -1;
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0 || n > 6) throw new AiCoachValidationError("dayOfWeek phải trong khoảng 0-6");
  return n;
}

function parseChannel(value: unknown): OutboundChannel {
  const channel = String(value || "").trim().toUpperCase() as OutboundChannel;
  if (!OUTBOUND_CHANNELS.includes(channel)) throw new AiCoachValidationError("Kênh outbound không hợp lệ");
  return channel;
}

async function resolveSingleBranch(auth: AuthPayload, requested?: string | null) {
  if (requested) {
    const scoped = await enforceBranchScope(requested, auth);
    if (!scoped) throw new AiCoachForbiddenError(API_ERROR_VI.forbidden);
    return scoped;
  }
  const allowed = await getAllowedBranchIds(auth);
  if (allowed.length === 0) throw new AiCoachForbiddenError(API_ERROR_VI.forbidden);
  return allowed[0];
}

async function resolveBranchList(auth: AuthPayload, requested?: string | null) {
  if (requested) {
    const scoped = await enforceBranchScope(requested, auth);
    if (!scoped) throw new AiCoachForbiddenError(API_ERROR_VI.forbidden);
    return [scoped];
  }
  const allowed = await getAllowedBranchIds(auth);
  if (allowed.length === 0) throw new AiCoachForbiddenError(API_ERROR_VI.forbidden);
  return allowed;
}

export async function getKpiTargets(input: {
  auth: AuthPayload;
  branchId?: string;
  role?: string;
  dayOfWeek?: number | null;
  ownerId?: string;
  activeOnly?: boolean;
}) {
  const branchIds = await resolveBranchList(input.auth, input.branchId);
  const where: Prisma.KpiTargetWhereInput = {
    branchId: { in: branchIds },
    ...(input.role ? { role: parseRole(input.role) } : {}),
    ...(input.dayOfWeek !== undefined ? { dayOfWeek: parseDayOfWeek(input.dayOfWeek) } : {}),
    ...(input.ownerId ? { ownerId: input.ownerId } : {}),
    metricKey: { in: KPI_METRIC_KEYS },
    ...(input.activeOnly ? { isActive: true } : {}),
  };

  const items = await prisma.kpiTarget.findMany({
    where,
    include: {
      owner: { select: { id: true, name: true, email: true, role: true, branchId: true } },
      branch: { select: { id: true, name: true } },
    },
    orderBy: [{ branchId: "asc" }, { role: "asc" }, { metricKey: "asc" }, { dayOfWeek: "asc" }],
  });
  return {
    items: items.map((item) => ({
      ...item,
      dayOfWeek: item.dayOfWeek < 0 ? null : item.dayOfWeek,
      roleLabelVi: roleLabelVi(item.role),
      metricLabelVi: getMetricLabelVi(item.metricKey),
      metricDescVi: getMetricDef(item.metricKey)?.descVi ?? "",
      metricUnit: getMetricDef(item.metricKey)?.unit ?? "%",
    })),
  };
}

export async function upsertKpiTargets(input: {
  auth: AuthPayload;
  branchId?: string;
  items: Array<{
    branchId?: string;
    role: string;
    ownerId?: string | null;
    metricKey: string;
    targetValue: number;
    dayOfWeek?: number | null;
    isActive?: boolean;
  }>;
}) {
  if (!Array.isArray(input.items) || input.items.length === 0) {
    throw new AiCoachValidationError("Thiếu danh sách target");
  }

  const rows = await prisma.$transaction(async (tx) => {
    const created = [];
    for (const row of input.items) {
      const branchId = await resolveSingleBranch(input.auth, row.branchId || input.branchId);
      const role = parseRole(row.role);
      const metricKey = String(row.metricKey || "").trim();
      if (!metricKey) throw new AiCoachValidationError("Thiếu chỉ số KPI");
      if (!getMetricDef(metricKey)) throw new AiCoachValidationError("Chỉ số KPI không tồn tại trong danh mục");
      if (!isMetricAllowedForRole(metricKey, role)) {
        throw new AiCoachValidationError(
          `Chỉ số '${getMetricLabelVi(metricKey)}' không áp dụng cho vai trò '${roleLabelVi(role)}'`
        );
      }
      const targetValue = parsePercentTarget(row.targetValue);
      const dayOfWeek = parseDayOfWeek(row.dayOfWeek);

      let ownerId: string | null = null;
      if (row.ownerId) {
        const owner = await tx.user.findUnique({
          where: { id: row.ownerId },
          select: { id: true, role: true, branchId: true, isActive: true },
        });
        if (!owner || !owner.isActive) throw new AiCoachValidationError("Không tìm thấy nhân sự áp dụng");
        if (!owner.branchId || owner.branchId !== branchId) {
          throw new AiCoachValidationError("Nhân sự không thuộc chi nhánh đã chọn");
        }
        if (owner.role !== role) {
          throw new AiCoachValidationError("Nhân sự không đúng vai trò của target");
        }
        ownerId = owner.id;
      }

      const existing = await tx.kpiTarget.findFirst({
        where: {
          branchId,
          role,
          metricKey,
          dayOfWeek,
          ownerId,
        },
      });

      const item = existing
        ? await tx.kpiTarget.update({
            where: { id: existing.id },
            data: {
              targetValue,
              isActive: row.isActive ?? true,
            },
          })
        : await tx.kpiTarget.create({
            data: {
              branchId,
              role,
              ownerId,
              metricKey,
              targetValue,
              dayOfWeek,
              isActive: row.isActive ?? true,
            },
          });
      created.push(item);
    }
    return created;
  });

  return {
    count: rows.length,
    items: rows.map((item) => ({
      ...item,
      dayOfWeek: item.dayOfWeek < 0 ? null : item.dayOfWeek,
      roleLabelVi: roleLabelVi(item.role),
      metricLabelVi: getMetricLabelVi(item.metricKey),
      metricDescVi: getMetricDef(item.metricKey)?.descVi ?? "",
      metricUnit: getMetricDef(item.metricKey)?.unit ?? "%",
    })),
  };
}

export async function getGoals(input: {
  auth: AuthPayload;
  periodType: GoalPeriodType;
  dateKey?: string;
  monthKey?: string;
  branchId?: string;
}) {
  if (input.periodType === "DAILY") {
    if (!input.dateKey) throw new AiCoachValidationError("Thiếu dateKey cho mục tiêu ngày");
    ensureYmd(input.dateKey);
  }
  if (input.periodType === "MONTHLY") {
    if (!input.monthKey) throw new AiCoachValidationError("Thiếu monthKey cho mục tiêu tháng");
    ensureYm(input.monthKey);
  }

  const branchIds = await resolveBranchList(input.auth, input.branchId);
  const where: Prisma.GoalSettingWhereInput = {
    periodType: input.periodType,
    ...(input.periodType === "DAILY" ? { dateKey: input.dateKey } : { monthKey: input.monthKey }),
    branchId: { in: branchIds },
  };

  const items = await prisma.goalSetting.findMany({
    where,
    include: {
      branch: { select: { id: true, name: true } },
      createdBy: { select: { id: true, name: true, email: true } },
    },
    orderBy: [{ branchId: "asc" }, { updatedAt: "desc" }],
  });
  return { items };
}

export async function upsertGoal(input: {
  auth: AuthPayload;
  periodType: GoalPeriodType;
  branchId?: string | null;
  dateKey?: string;
  monthKey?: string;
  revenueTarget: number;
  dossierTarget: number;
  costTarget: number;
  note?: string;
}) {
  if (input.periodType === "DAILY") {
    if (!input.dateKey) throw new AiCoachValidationError("Thiếu dateKey cho mục tiêu ngày");
    ensureYmd(input.dateKey);
  }
  if (input.periodType === "MONTHLY") {
    if (!input.monthKey) throw new AiCoachValidationError("Thiếu monthKey cho mục tiêu tháng");
    ensureYm(input.monthKey);
  }

  let branchId: string | null = null;
  if (input.branchId) {
    branchId = await resolveSingleBranch(input.auth, input.branchId);
  } else if (input.auth.role !== "admin") {
    // manager/director bắt buộc theo chi nhánh của mình
    branchId = await resolveSingleBranch(input.auth, null);
  }

  const row = await prisma.goalSetting.upsert({
    where: {
      branchScopeKey_periodType_dateKey_monthKey: {
        branchScopeKey: branchId ?? "SYSTEM",
        periodType: input.periodType,
        dateKey: input.periodType === "DAILY" ? input.dateKey! : "",
        monthKey: input.periodType === "MONTHLY" ? input.monthKey! : "",
      },
    },
    create: {
      branchId,
      branchScopeKey: branchId ?? "SYSTEM",
      periodType: input.periodType,
      dateKey: input.periodType === "DAILY" ? input.dateKey! : "",
      monthKey: input.periodType === "MONTHLY" ? input.monthKey! : "",
      revenueTarget: parseIntNonNegative(input.revenueTarget, "revenueTarget"),
      dossierTarget: parseIntNonNegative(input.dossierTarget, "dossierTarget"),
      costTarget: parseIntNonNegative(input.costTarget, "costTarget"),
      note: input.note?.trim() || null,
      createdById: input.auth.sub,
    },
    update: {
      revenueTarget: parseIntNonNegative(input.revenueTarget, "revenueTarget"),
      dossierTarget: parseIntNonNegative(input.dossierTarget, "dossierTarget"),
      costTarget: parseIntNonNegative(input.costTarget, "costTarget"),
      note: input.note?.trim() || null,
      createdById: input.auth.sub,
    },
    include: {
      branch: { select: { id: true, name: true } },
      createdBy: { select: { id: true, name: true, email: true } },
    },
  });

  return { goal: row };
}

export async function listAiSuggestions(input: {
  auth: AuthPayload;
  dateKey?: string;
  role?: string;
  branchId?: string;
  ownerId?: string;
}) {
  const dateKey = input.dateKey || todayInHoChiMinh();
  ensureYmd(dateKey);
  const scope = await resolveScope(input.auth);
  const allowedBranchIds = await getAllowedBranchIds(input.auth);

  const andClauses: Prisma.AiSuggestionWhereInput[] = [{ dateKey }, { status: "ACTIVE" }];
  if (input.role) andClauses.push({ role: parseRole(input.role, true) });

  if (scope.mode === "SYSTEM") {
    if (input.branchId) {
      const scoped = await enforceBranchScope(input.branchId, input.auth);
      if (!scoped) throw new AiCoachForbiddenError(API_ERROR_VI.forbidden);
      andClauses.push({ branchId: scoped });
    } else if (allowedBranchIds.length > 0) {
      andClauses.push({ OR: [{ branchId: { in: allowedBranchIds } }, { branchId: null }] });
    }
    if (input.ownerId) andClauses.push({ ownerId: input.ownerId });
  } else if (scope.mode === "BRANCH") {
    andClauses.push({ branchId: { in: allowedBranchIds } });
    if (input.ownerId) andClauses.push({ ownerId: input.ownerId });
  } else {
    const ownerClause: Prisma.AiSuggestionWhereInput = { OR: [{ ownerId: scope.ownerId }, { ownerId: null }] };
    andClauses.push(ownerClause);
    if (allowedBranchIds.length > 0) {
      andClauses.push({ OR: [{ branchId: { in: allowedBranchIds } }, { branchId: null }] });
    }
  }

  const where: Prisma.AiSuggestionWhereInput = { AND: andClauses };
  const items = await prisma.aiSuggestion.findMany({
    where,
    include: {
      branch: { select: { id: true, name: true } },
      owner: { select: { id: true, name: true, email: true } },
      feedbacks: {
        orderBy: { createdAt: "desc" },
        take: 5,
        select: { id: true, userId: true, rating: true, applied: true, note: true, createdAt: true },
      },
      _count: { select: { feedbacks: true } },
    },
    orderBy: [{ scoreColor: "asc" }, { createdAt: "desc" }],
  });

  return { items };
}

export async function createAiSuggestionManual(input: {
  auth: AuthPayload;
  dateKey?: string;
  role: string;
  branchId?: string;
  ownerId?: string | null;
  title: string;
  content: string;
  scoreColor: string;
  actionsJson?: unknown;
  metricsJson?: unknown;
}) {
  const dateKey = input.dateKey || todayInHoChiMinh();
  ensureYmd(dateKey);
  const role = parseRole(input.role, true);
  const title = String(input.title || "").trim();
  const content = String(input.content || "").trim();
  if (!title || !content) throw new AiCoachValidationError("Thiếu tiêu đề hoặc nội dung gợi ý");

  let branchId: string | null = null;
  if (input.branchId) {
    branchId = await resolveSingleBranch(input.auth, input.branchId);
  } else if (input.auth.role !== "admin") {
    branchId = await resolveSingleBranch(input.auth, null);
  }

  let ownerId: string | null = null;
  if (input.ownerId) {
    const owner = await prisma.user.findUnique({
      where: { id: input.ownerId },
      select: { id: true, branchId: true, isActive: true },
    });
    if (!owner || !owner.isActive) {
      throw new AiCoachValidationError("Không tìm thấy nhân sự áp dụng");
    }
    if (branchId && owner.branchId !== branchId) {
      throw new AiCoachValidationError("Nhân sự không thuộc chi nhánh đã chọn");
    }
    ownerId = owner.id;
  }

  const row = await prisma.aiSuggestion.create({
    data: {
      dateKey,
      role,
      branchId,
      ownerId,
      status: "ACTIVE",
      title,
      content,
      scoreColor: parseColor(input.scoreColor),
      actionsJson: (input.actionsJson as Prisma.InputJsonValue) ?? null,
      metricsJson: (input.metricsJson as Prisma.InputJsonValue) ?? null,
      source: "manual",
      payloadHash: hashPayload({
        dateKey,
        role,
        branchId,
        ownerId,
        title,
        content,
        scoreColor: input.scoreColor,
      }),
    },
    include: {
      branch: { select: { id: true, name: true } },
      owner: { select: { id: true, name: true, email: true } },
    },
  });

  return { suggestion: row };
}

export async function ingestAiSuggestions(payload: {
  source: string;
  runId: string;
  suggestions: Array<{
    dateKey: string;
    role: string;
    branchId?: string | null;
    ownerId?: string | null;
    status?: string;
    title: string;
    content: string;
    scoreColor: string;
    actionsJson?: unknown;
    metricsJson?: unknown;
    payloadHash?: string;
  }>;
}) {
  const source = payload.source.trim().toLowerCase();
  const runId = payload.runId.trim();
  if (source !== "n8n" || !runId) {
    throw new AiCoachValidationError("Payload phải có source='n8n' và runId");
  }
  if (!Array.isArray(payload.suggestions) || payload.suggestions.length === 0) {
    throw new AiCoachValidationError("Danh sách suggestions là bắt buộc");
  }

  const rows = [];
  for (const row of payload.suggestions) {
    ensureYmd(String(row.dateKey || ""));
    const role = parseRole(row.role, true);
    const status = String(row.status || "ACTIVE").toUpperCase();
    if (status !== "ACTIVE" && status !== "ARCHIVED") {
      throw new AiCoachValidationError("status không hợp lệ");
    }
    const title = String(row.title || "").trim();
    const content = String(row.content || "").trim();
    if (!title || !content) throw new AiCoachValidationError("title/content là bắt buộc");

    const item = await prisma.aiSuggestion.create({
      data: {
        dateKey: row.dateKey,
        role,
        branchId: row.branchId || null,
        ownerId: row.ownerId || null,
        status: status as "ACTIVE" | "ARCHIVED",
        title,
        content,
        scoreColor: parseColor(row.scoreColor),
        actionsJson: (row.actionsJson as Prisma.InputJsonValue) ?? null,
        metricsJson: (row.metricsJson as Prisma.InputJsonValue) ?? null,
        source,
        runId,
        payloadHash: row.payloadHash || hashPayload(row),
      },
    });
    rows.push(item);
  }
  return { count: rows.length, items: rows };
}

export async function addAiSuggestionFeedback(input: {
  auth: AuthPayload;
  suggestionId: string;
  rating: number;
  applied?: boolean;
  note?: string;
}) {
  if (!Number.isInteger(input.rating) || input.rating < 1 || input.rating > 5) {
    throw new AiCoachValidationError("rating phải trong khoảng 1-5");
  }

  const scope = await resolveScope(input.auth);
  const allowedBranches = await getAllowedBranchIds(input.auth);
  const suggestion = await prisma.aiSuggestion.findUnique({
    where: { id: input.suggestionId },
    select: { id: true, branchId: true, ownerId: true },
  });
  if (!suggestion) throw new AiCoachValidationError("Không tìm thấy gợi ý");

  if (scope.mode === "OWNER") {
    if (suggestion.ownerId && suggestion.ownerId !== input.auth.sub) throw new AiCoachForbiddenError(API_ERROR_VI.forbidden);
    if (suggestion.branchId && !allowedBranches.includes(suggestion.branchId)) {
      throw new AiCoachForbiddenError(API_ERROR_VI.forbidden);
    }
  }
  if (scope.mode === "BRANCH") {
    if (suggestion.branchId && !allowedBranches.includes(suggestion.branchId)) {
      throw new AiCoachForbiddenError(API_ERROR_VI.forbidden);
    }
  }

  const feedback = await prisma.aiSuggestionFeedback.create({
    data: {
      suggestionId: input.suggestionId,
      userId: input.auth.sub,
      rating: input.rating,
      applied: input.applied ?? false,
      note: input.note?.trim() || null,
    },
  });
  return { feedback };
}

export async function createOutboundJobFromAction(input: {
  auth: AuthPayload;
  body: {
    channel: unknown;
    templateKey: unknown;
    leadId?: unknown;
    studentId?: unknown;
    to?: unknown;
    priority?: unknown;
    variables?: unknown;
    note?: unknown;
  };
}) {
  await ensureOutboundSchema();
  const channel = parseChannel(input.body.channel);
  const templateKey = String(input.body.templateKey || "").trim();
  if (!templateKey) throw new AiCoachValidationError("templateKey là bắt buộc");

  const template = await prisma.messageTemplate.findUnique({ where: { key: templateKey } });
  if (!template || !template.isActive) throw new AiCoachValidationError("Không tìm thấy mẫu tin nhắn");

  const scope = await resolveScope(input.auth);
  let lead: { id: string; phone: string | null; fullName: string | null; ownerId: string | null; branchId: string } | null = null;
  let student: {
    id: string;
    branchId: string;
    lead: { id: string; phone: string | null; fullName: string | null; ownerId: string | null; branchId: string };
  } | null = null;

  if (typeof input.body.leadId === "string") {
    lead = await prisma.lead.findUnique({
      where: { id: input.body.leadId },
      select: { id: true, phone: true, fullName: true, ownerId: true, branchId: true },
    });
    if (!lead) throw new AiCoachValidationError("Không tìm thấy khách hàng");
  }

  if (typeof input.body.studentId === "string") {
    student = await prisma.student.findUnique({
      where: { id: input.body.studentId },
      select: {
        id: true,
        branchId: true,
        lead: { select: { id: true, phone: true, fullName: true, ownerId: true, branchId: true } },
      },
    });
    if (!student) throw new AiCoachValidationError("Không tìm thấy học viên");
    if (!lead) lead = student.lead;
  }

  if (!lead && !student) {
    throw new AiCoachValidationError("Cần chọn leadId hoặc studentId");
  }

  if (scope.mode === "OWNER") {
    const ownerId = lead?.ownerId || student?.lead.ownerId || null;
    if (!ownerId || ownerId !== scope.ownerId) throw new AiCoachForbiddenError(API_ERROR_VI.forbidden);
    if (scope.branchId) {
      const branchId = lead?.branchId || student?.branchId;
      if (!branchId || branchId !== scope.branchId) throw new AiCoachForbiddenError(API_ERROR_VI.forbidden);
    }
  }
  if (scope.mode === "BRANCH" && scope.branchId) {
    const branchId = lead?.branchId || student?.branchId;
    if (!branchId || branchId !== scope.branchId) throw new AiCoachForbiddenError(API_ERROR_VI.forbidden);
  }

  const variablesRaw =
    input.body.variables && typeof input.body.variables === "object" && !Array.isArray(input.body.variables)
      ? (input.body.variables as Record<string, unknown>)
      : {};

  const variables: Record<string, unknown> = {
    name: lead?.fullName || student?.lead.fullName || "",
    phone: lead?.phone || student?.lead.phone || "",
    ...(variablesRaw || {}),
  };

  const to =
    typeof input.body.to === "string" && input.body.to.trim()
      ? input.body.to.trim()
      : channel === "ZALO" || channel === "SMS"
        ? lead?.phone || student?.lead.phone || null
        : null;

  if ((channel === "ZALO" || channel === "SMS") && !to) {
    throw new AiCoachValidationError("Thiếu số điện thoại nhận tin");
  }

  const priority =
    String(input.body.priority || "MEDIUM").toUpperCase() === "HIGH"
      ? OutboundPriority.HIGH
      : String(input.body.priority || "MEDIUM").toUpperCase() === "LOW"
        ? OutboundPriority.LOW
        : OutboundPriority.MEDIUM;

  const branchId = await resolveWriteBranchId(input.auth, [lead?.branchId, student?.branchId]);
  const outboundMessage = await prisma.outboundMessage.create({
    data: {
      channel,
      templateKey,
      renderedText: renderTemplate(template.body, variables),
      to,
      priority,
      status: "QUEUED",
      leadId: lead?.id || null,
      studentId: student?.id || null,
      branchId,
      error: typeof input.body.note === "string" && input.body.note.trim() ? `AI_ACTION: ${input.body.note.trim()}` : null,
    },
  });

  return { outboundMessage };
}
