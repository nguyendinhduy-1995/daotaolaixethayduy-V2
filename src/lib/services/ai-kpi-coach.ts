import {
  type AiScoreColor,
  type AiSuggestionFeedbackType,
  type GoalPeriodType,
  OutboundPriority,
  type OutboundChannel,
  type Role,
  Prisma,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { AuthPayload } from "@/lib/auth";
import { API_ERROR_VI } from "@/lib/api-error-vi";
import { ensureOutboundSchema, renderTemplate } from "@/lib/outbound-db";
import { enforceBranchScope, getAllowedBranchIds, resolveScope, resolveWriteBranchId } from "@/lib/scope";
import { KPI_METRICS_CATALOG, getMetricDef, getMetricLabelVi, isMetricAllowedForRole, roleLabelVi } from "@/lib/kpi-metrics-catalog";
import { todayInHoChiMinh as todayHcm, dayRangeInHoChiMinh, monthRangeInHoChiMinh as monthRangeHcm, addDays, isYmd, isYm } from "@/lib/utils/date";
import { hashPayload } from "@/lib/utils/hash";

const TARGET_ROLES: Role[] = ["direct_page", "telesales"];
const SUGGESTION_COLORS: AiScoreColor[] = ["RED", "YELLOW", "GREEN"];
const OUTBOUND_CHANNELS: OutboundChannel[] = ["ZALO", "FB", "SMS", "CALL_NOTE"];
const KPI_METRIC_KEYS = KPI_METRICS_CATALOG.map((item) => item.key);
const FEEDBACK_TYPES: AiSuggestionFeedbackType[] = ["HELPFUL", "NOT_HELPFUL", "DONE"];
const FEEDBACK_REASON_KEYS = [
  "dung_trong_luc_can",
  "de_lam_theo",
  "chua_sat_thuc_te",
  "thieu_du_lieu",
  "uu_tien_khac",
  "khac",
] as const;
type FeedbackReasonKey = (typeof FEEDBACK_REASON_KEYS)[number];

export class AiCoachValidationError extends Error { }
export class AiCoachForbiddenError extends Error { }

function todayInHoChiMinh() {
  return todayHcm().dateKey;
}

function ensureYmd(dateKey: string) {
  if (!isYmd(dateKey)) throw new AiCoachValidationError("dateKey phải có dạng YYYY-MM-DD");
}

function ensureYm(monthKey: string) {
  if (!isYm(monthKey)) throw new AiCoachValidationError("monthKey phải có dạng YYYY-MM");
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

function parseFeedbackType(value: unknown): AiSuggestionFeedbackType {
  const type = String(value || "").trim().toUpperCase() as AiSuggestionFeedbackType;
  if (!FEEDBACK_TYPES.includes(type)) {
    throw new AiCoachValidationError("Loại phản hồi không hợp lệ");
  }
  return type;
}

function parseFeedbackReason(value: unknown): FeedbackReasonKey {
  const reason = String(value || "").trim() as FeedbackReasonKey;
  if (!FEEDBACK_REASON_KEYS.includes(reason)) {
    throw new AiCoachValidationError("Lý do phản hồi không hợp lệ");
  }
  return reason;
}

function parseOptionalCount(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0) {
    throw new AiCoachValidationError("Kết quả thực tế phải là số nguyên không âm");
  }
  return n;
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
  const allowed = await getAllowedBranchIds(auth);
  if (requested) {
    const scoped = await enforceBranchScope(requested, auth, allowed);
    if (!scoped) throw new AiCoachForbiddenError(API_ERROR_VI.forbidden);
    return scoped;
  }
  if (allowed.length === 0) throw new AiCoachForbiddenError(API_ERROR_VI.forbidden);
  return allowed[0];
}

async function resolveBranchList(auth: AuthPayload, requested?: string | null) {
  const allowed = await getAllowedBranchIds(auth);
  if (requested) {
    const scoped = await enforceBranchScope(requested, auth, allowed);
    if (!scoped) throw new AiCoachForbiddenError(API_ERROR_VI.forbidden);
    return [scoped];
  }
  if (allowed.length === 0) throw new AiCoachForbiddenError(API_ERROR_VI.forbidden);
  return allowed;
}

function monthRangeInHoChiMinh(dateKey: string) {
  const monthKey = dateKey.slice(0, 7);
  const { start, end } = monthRangeHcm(monthKey);
  return { monthKey, start, end };
}

function readN8nNotes(metricsJson: Prisma.JsonValue | null): string {
  if (!metricsJson || typeof metricsJson !== "object" || Array.isArray(metricsJson)) return "";
  const notes = (metricsJson as Record<string, unknown>).n8nNotes;
  return typeof notes === "string" ? notes : "";
}

async function ensureSkeletonSuggestions(input: {
  auth: AuthPayload;
  dateKey: string;
  allowedBranchIds: string[];
  scope: { mode: "SYSTEM" | "BRANCH" | "OWNER"; branchId?: string; ownerId?: string };
  requestedBranchId?: string;
}) {
  const { start: dayStart, end: dayEnd } = dayRangeInHoChiMinh(input.dateKey);
  const { start: monthStart, end: monthEnd } = monthRangeInHoChiMinh(input.dateKey);
  const weekAhead = addDays(dayStart, 7);
  const twoWeeksAhead = addDays(dayStart, 14);

  const scopedBranchIds = input.requestedBranchId ? [input.requestedBranchId] : input.allowedBranchIds;
  if (scopedBranchIds.length === 0) return;

  const ownerId = input.scope.mode === "OWNER" ? input.scope.ownerId || null : null;
  const branchFilter = { branchId: { in: scopedBranchIds } };
  const leadScope: Prisma.LeadWhereInput = ownerId ? { ...branchFilter, ownerId } : branchFilter;
  const studentScope: Prisma.StudentWhereInput = ownerId
    ? { ...branchFilter, lead: { ownerId } }
    : branchFilter;

  const [hasPhoneNoHen, henNoDen, denNoKy, noRecentReceipt, expenseToday, expenseMonth, scheduleRisk] = await Promise.all([
    prisma.lead.count({
      where: {
        ...leadScope,
        status: "HAS_PHONE",
        updatedAt: { lte: dayEnd },
      },
    }),
    prisma.lead.count({
      where: {
        ...leadScope,
        status: "APPOINTED",
        updatedAt: { lte: dayEnd },
      },
    }),
    prisma.lead.count({
      where: {
        ...leadScope,
        status: "ARRIVED",
        updatedAt: { lte: dayEnd },
      },
    }),
    prisma.student.count({
      where: {
        ...studentScope,
        studyStatus: "studying",
        receipts: {
          none: {
            receivedAt: { gte: addDays(dayStart, -14), lte: dayEnd },
          },
        },
      },
    }),
    prisma.branchExpenseDaily.aggregate({
      where: {
        branchId: { in: scopedBranchIds },
        date: { gte: dayStart, lte: dayEnd },
      },
      _sum: { amountVnd: true },
    }),
    prisma.branchExpenseDaily.aggregate({
      where: {
        branchId: { in: scopedBranchIds },
        date: { gte: monthStart, lte: monthEnd },
      },
      _sum: { amountVnd: true },
    }),
    prisma.student.count({
      where: {
        ...studentScope,
        examDate: { gte: dayStart, lte: twoWeeksAhead },
        OR: [
          { courseId: null },
          {
            course: {
              scheduleItems: {
                none: {
                  isActive: true,
                  startAt: { gte: dayStart, lte: weekAhead },
                },
              },
            },
          },
        ],
      },
    }),
  ]);

  const candidates: Array<{
    role: Role;
    title: string;
    content: string;
    scoreColor: AiScoreColor;
    actionsJson: Prisma.InputJsonValue;
    metricsJson: Prisma.InputJsonValue;
  }> = [];

  if (hasPhoneNoHen > 0) {
    candidates.push({
      role: "telesales",
      title: `Cần xử lý ${hasPhoneNoHen} khách có số chưa có lịch hẹn`,
      content: "Ưu tiên gọi nhắc nhóm khách đã có số nhưng chưa chốt lịch hẹn trong ngày.",
      scoreColor: hasPhoneNoHen >= 10 ? "RED" : "YELLOW",
      actionsJson: [
        {
          type: "CREATE_OUTBOUND_JOB",
          channel: "CALL_NOTE",
          label: "Tạo danh sách gọi nhắc khách có số",
          description: "Gọi trong khung giờ 9h-11h và 14h-17h để tăng tỉ lệ hẹn",
        },
        {
          type: "UPDATE_LEAD_STATUS",
          label: "Rà trạng thái khách chưa hẹn",
          description: "Sau khi gọi, cập nhật lại trạng thái khách cho đúng thực tế",
        },
      ] as Prisma.InputJsonValue,
      metricsJson: {
        sourceModule: "leads",
        hasPhoneNoHen,
        n8nNotes:
          "n8n đọc /api/leads?status=HAS_PHONE, lọc khách chưa hẹn, gom danh sách gọi nhắc rồi đẩy /api/outbound/jobs.",
      } as Prisma.InputJsonValue,
    });
  }

  if (henNoDen > 0 || denNoKy > 0) {
    candidates.push({
      role: "telesales",
      title: `Nhóm khách cần bám sát: ${henNoDen} chưa đến, ${denNoKy} chưa ký`,
      content: "Cần gọi nhắc khách đã hẹn nhưng chưa đến và nhóm đã đến nhưng chưa ký.",
      scoreColor: henNoDen + denNoKy >= 10 ? "RED" : "YELLOW",
      actionsJson: [
        {
          type: "CREATE_OUTBOUND_JOB",
          channel: "CALL_NOTE",
          label: "Tạo danh sách gọi nhắc theo phễu",
          description: "Ưu tiên nhóm đã hẹn nhưng chưa đến trước",
        },
      ] as Prisma.InputJsonValue,
      metricsJson: {
        sourceModule: "kpi",
        henNoDen,
        denNoKy,
        n8nNotes:
          "n8n lấy phễu KPI ngày từ /api/kpi/daily, xác định điểm nghẽn Hẹn/Đến/Ký và tạo job gọi nhắc phù hợp.",
      } as Prisma.InputJsonValue,
    });
  }

  if (noRecentReceipt > 0) {
    candidates.push({
      role: "manager",
      title: `Có ${noRecentReceipt} học viên cần nhắc thu tiền`,
      content: "Nhóm học viên chưa có phiếu thu gần đây cần được nhắc để tránh dồn công nợ cuối tháng.",
      scoreColor: noRecentReceipt >= 8 ? "RED" : "YELLOW",
      actionsJson: [
        {
          type: "CREATE_TASK",
          label: "Tạo việc nhắc thu tiền",
          description: "Chia danh sách theo nhân sự phụ trách để xử lý trong ngày",
        },
        {
          type: "CREATE_OUTBOUND_JOB",
          channel: "SMS",
          label: "Tạo danh sách nhắn nhắc học phí",
          description: "Gửi tin nhắn nhắc nợ nhẹ nhàng cho học viên đến hạn",
        },
      ] as Prisma.InputJsonValue,
      metricsJson: {
        sourceModule: "receipts",
        noRecentReceipt,
        n8nNotes:
          "n8n đọc /api/receipts/summary + /api/students, lọc học viên đến hạn chưa thu rồi tạo việc và danh sách nhắn nhắc.",
      } as Prisma.InputJsonValue,
    });
  }

  const expenseTodayVnd = expenseToday._sum.amountVnd ?? 0;
  const expenseMonthVnd = expenseMonth._sum.amountVnd ?? 0;
  if (expenseTodayVnd >= 8_000_000 || expenseMonthVnd >= 120_000_000) {
    candidates.push({
      role: "manager",
      title: "Chi phí đang vượt ngưỡng theo dõi",
      content: `Chi phí hôm nay khoảng ${expenseTodayVnd.toLocaleString("vi-VN")}đ, tháng này khoảng ${expenseMonthVnd.toLocaleString("vi-VN")}đ.`,
      scoreColor: expenseTodayVnd >= 12_000_000 || expenseMonthVnd >= 160_000_000 ? "RED" : "YELLOW",
      actionsJson: [
        {
          type: "CREATE_TASK",
          label: "Rà soát chi phí vượt ngưỡng",
          description: "Kiểm tra khoản phát sinh lớn và xác nhận tính hợp lệ",
        },
      ] as Prisma.InputJsonValue,
      metricsJson: {
        sourceModule: "expenses",
        expenseTodayVnd,
        expenseMonthVnd,
        n8nNotes:
          "n8n đọc /api/expenses/summary theo tháng, so với ngưỡng từng chi nhánh rồi sinh cảnh báo vượt ngưỡng.",
      } as Prisma.InputJsonValue,
    });
  }

  if (scheduleRisk > 0) {
    candidates.push({
      role: "manager",
      title: `Lịch học có rủi ro cho ${scheduleRisk} học viên gần ngày thi`,
      content: "Một số học viên gần ngày thi nhưng lịch học sắp tới đang thiếu hoặc chưa đủ buổi.",
      scoreColor: scheduleRisk >= 6 ? "RED" : "YELLOW",
      actionsJson: [
        {
          type: "CREATE_REMINDER",
          label: "Tạo việc bổ sung lịch học",
          description: "Bổ sung buổi học còn thiếu cho học viên gần ngày thi",
        },
      ] as Prisma.InputJsonValue,
      metricsJson: {
        sourceModule: "schedule",
        scheduleRisk,
        n8nNotes:
          "n8n đọc /api/schedule + /api/students (gần ngày thi), đánh dấu học viên thiếu lịch và gửi nhắc xử lý.",
      } as Prisma.InputJsonValue,
    });
  }

  const branchIdForCreate = scopedBranchIds[0] ?? null;
  const runId = `rule-skeleton-${input.dateKey}`;

  for (const candidate of candidates) {
    const payloadHash = hashPayload({
      dateKey: input.dateKey,
      role: candidate.role,
      branchId: branchIdForCreate,
      ownerId,
      title: candidate.title,
      source: "rule_skeleton_v2",
    });

    const existing = await prisma.aiSuggestion.findFirst({
      where: { dateKey: input.dateKey, payloadHash, source: "rule_skeleton_v2" },
      select: { id: true },
    });
    if (existing) continue;

    await prisma.aiSuggestion.create({
      data: {
        dateKey: input.dateKey,
        role: candidate.role,
        branchId: branchIdForCreate,
        ownerId,
        status: "ACTIVE",
        title: candidate.title,
        content: candidate.content,
        scoreColor: candidate.scoreColor,
        actionsJson: candidate.actionsJson,
        metricsJson: candidate.metricsJson,
        source: "rule_skeleton_v2",
        runId,
        payloadHash,
      },
    });
  }
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
  const requestedBranchId = input.branchId ? await enforceBranchScope(input.branchId, input.auth, allowedBranchIds) : null;
  if (input.branchId && !requestedBranchId) {
    throw new AiCoachForbiddenError(API_ERROR_VI.forbidden);
  }

  await ensureSkeletonSuggestions({
    auth: input.auth,
    dateKey,
    allowedBranchIds,
    scope,
    requestedBranchId: requestedBranchId || undefined,
  });

  const andClauses: Prisma.AiSuggestionWhereInput[] = [{ dateKey }, { status: "ACTIVE" }];
  if (input.role) andClauses.push({ role: parseRole(input.role, true) });

  if (scope.mode === "SYSTEM") {
    if (requestedBranchId) {
      andClauses.push({ branchId: requestedBranchId });
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
        select: {
          id: true,
          userId: true,
          feedbackType: true,
          reason: true,
          reasonDetail: true,
          actualResult: true,
          rating: true,
          applied: true,
          note: true,
          createdAt: true,
        },
      },
      _count: { select: { feedbacks: true } },
    },
    orderBy: [{ scoreColor: "asc" }, { createdAt: "desc" }],
  });

  return {
    items: items.map((item) => {
      const feedbackStats = item.feedbacks.reduce(
        (acc, row) => {
          if (row.feedbackType === "HELPFUL") acc.helpful += 1;
          if (row.feedbackType === "NOT_HELPFUL") acc.notHelpful += 1;
          if (row.feedbackType === "DONE") acc.done += 1;
          return acc;
        },
        { total: item._count.feedbacks, helpful: 0, notHelpful: 0, done: 0 }
      );
      const myFeedback = item.feedbacks.find((row) => row.userId === input.auth.sub) || null;
      return {
        ...item,
        feedbackStats,
        myFeedback,
        n8nNotes: readN8nNotes(item.metricsJson),
      };
    }),
  };
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
  feedbackType: string;
  reason: string;
  reasonDetail?: string;
  actualResult?: {
    data?: number | null;
    hen?: number | null;
    den?: number | null;
    ky?: number | null;
  };
  note?: string;
}) {
  const feedbackType = parseFeedbackType(input.feedbackType);
  const reason = parseFeedbackReason(input.reason);
  const reasonDetail = String(input.reasonDetail || "").trim();
  if (reason === "khac" && !reasonDetail) {
    throw new AiCoachValidationError("Khi chọn lý do khác, cần nhập lý do cụ thể");
  }

  const actualResult = input.actualResult
    ? ({
      data: parseOptionalCount(input.actualResult.data),
      hen: parseOptionalCount(input.actualResult.hen),
      den: parseOptionalCount(input.actualResult.den),
      ky: parseOptionalCount(input.actualResult.ky),
    } satisfies Record<string, number | null>)
    : null;

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

  const existing = await prisma.aiSuggestionFeedback.findFirst({
    where: { suggestionId: input.suggestionId, userId: input.auth.sub },
    select: { id: true },
  });
  if (existing) {
    throw new AiCoachValidationError("Bạn đã phản hồi gợi ý này");
  }

  const rating = feedbackType === "HELPFUL" ? 5 : feedbackType === "NOT_HELPFUL" ? 1 : 4;
  const applied = feedbackType !== "NOT_HELPFUL";

  let feedback;
  try {
    feedback = await prisma.aiSuggestionFeedback.create({
      data: {
        suggestionId: input.suggestionId,
        userId: input.auth.sub,
        feedbackType,
        reason,
        reasonDetail: reasonDetail || null,
        actualResult: (actualResult as Prisma.InputJsonValue) ?? null,
        rating,
        applied,
        note: input.note?.trim() || null,
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new AiCoachValidationError("Bạn đã phản hồi gợi ý này");
    }
    throw error;
  }
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
