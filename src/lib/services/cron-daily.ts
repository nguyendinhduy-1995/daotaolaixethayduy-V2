import type { OutboundPriority, OutboundStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ensureDefaultMessageTemplates, ensureOutboundSchema, renderTemplate } from "@/lib/outbound-db";
import { runNotificationGenerate } from "@/lib/services/notification-generate";

type SkipReason = "quietHours" | "dedupe" | "caps" | "missingOwner" | "missingStudent";

type CronCounts = {
  notificationsCreated: number;
  notificationsSkipped: number;
  outboundQueued: number;
  outboundSkipped: number;
  errors: number;
};

type QueueItemPreview = {
  notificationId: string;
  studentName: string;
  ownerName: string;
  templateKey: string;
  priority: OutboundPriority;
  action: "queued" | "skipped";
  reason?: string;
};

type CronBreakdowns = {
  countsByPriority: Record<OutboundPriority, number>;
  countsByOwner: Array<{ ownerId: string; ownerName: string; count: number }>;
  skippedReasons: Record<SkipReason, number>;
};

type CronResult = {
  ok: boolean;
  dryRun: boolean;
  force: boolean;
  quietHoursBlocked: boolean;
  warning?: string;
  warnings?: string[];
  counts: CronCounts;
  breakdowns: CronBreakdowns;
  preview: QueueItemPreview[];
  notificationsCreated: number;
  notificationsSkipped: number;
  outboundQueued: number;
  outboundSkipped: number;
  errors: number;
};

function nowInTz(tz: string) {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
  return hour * 60 + minute;
}

function parseTimeToMinutes(v: string) {
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(v.trim());
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

function parseQuietRange(input: string) {
  const parts = input.split("-");
  if (parts.length !== 2) return null;
  const start = parseTimeToMinutes(parts[0]);
  const end = parseTimeToMinutes(parts[1]);
  if (start === null || end === null) return null;
  return { start, end };
}

function isInQuietRange(current: number, range: { start: number; end: number }) {
  if (range.start === range.end) return true;
  if (range.start < range.end) return current >= range.start && current < range.end;
  return current >= range.start || current < range.end;
}

function envInt(name: string, fallback: number) {
  const raw = process.env[name];
  if (!raw) return fallback;
  const num = Number(raw);
  if (!Number.isInteger(num) || num <= 0) return fallback;
  return num;
}

function pickTemplateKey(payload: unknown) {
  const obj = payload && typeof payload === "object" ? (payload as { paid50?: unknown; lastReceiptDays?: unknown }) : {};
  const paid50 = Boolean(obj.paid50);
  const lastReceiptDays = typeof obj.lastReceiptDays === "number" ? obj.lastReceiptDays : null;
  if (!paid50) return "remind_paid50";
  if (lastReceiptDays !== null && lastReceiptDays > 14) return "remind_remaining";
  return "remind_remaining";
}

function computePriority(payload: unknown, dueAt: Date | null): OutboundPriority {
  const obj = payload && typeof payload === "object" ? (payload as { tuitionTotal?: unknown; paidTotal?: unknown; lastReceiptDays?: unknown }) : {};
  const tuitionTotal = typeof obj.tuitionTotal === "number" ? obj.tuitionTotal : 0;
  const paidTotal = typeof obj.paidTotal === "number" ? obj.paidTotal : 0;
  const unpaidRatio = tuitionTotal > 0 ? Math.max(0, (tuitionTotal - paidTotal) / tuitionTotal) : 0;
  const lastReceiptDays = typeof obj.lastReceiptDays === "number" ? obj.lastReceiptDays : 0;
  const now = new Date();
  const dueMs = dueAt ? dueAt.getTime() - now.getTime() : Number.POSITIVE_INFINITY;
  const dueSoon = dueMs >= 0 && dueMs <= 3 * 24 * 60 * 60 * 1000;
  const overdue = dueAt ? dueAt.getTime() < now.getTime() : false;

  if (overdue || dueSoon || (unpaidRatio >= 0.5 && lastReceiptDays > 14)) return "HIGH";
  if (unpaidRatio >= 0.5) return "MEDIUM";
  return "LOW";
}

function initCounts(): CronCounts {
  return {
    notificationsCreated: 0,
    notificationsSkipped: 0,
    outboundQueued: 0,
    outboundSkipped: 0,
    errors: 0,
  };
}

function initBreakdowns(): CronBreakdowns {
  return {
    countsByPriority: { HIGH: 0, MEDIUM: 0, LOW: 0 },
    countsByOwner: [],
    skippedReasons: {
      quietHours: 0,
      dedupe: 0,
      caps: 0,
      missingOwner: 0,
      missingStudent: 0,
    },
  };
}

function buildResult(input: {
  dryRun: boolean;
  force: boolean;
  quietHoursBlocked: boolean;
  warning?: string;
  warnings?: string[];
  counts: CronCounts;
  breakdowns: CronBreakdowns;
  preview: QueueItemPreview[];
}): CronResult {
  return {
    ok: true,
    dryRun: input.dryRun,
    force: input.force,
    quietHoursBlocked: input.quietHoursBlocked,
    ...(input.warning ? { warning: input.warning } : {}),
    ...(input.warnings ? { warnings: input.warnings } : {}),
    counts: input.counts,
    breakdowns: input.breakdowns,
    preview: input.preview,
    notificationsCreated: input.counts.notificationsCreated,
    notificationsSkipped: input.counts.notificationsSkipped,
    outboundQueued: input.counts.outboundQueued,
    outboundSkipped: input.counts.outboundSkipped,
    errors: input.counts.errors,
  };
}

export async function runDailyCron(options: { dryRun: boolean; force?: boolean; requestedBy?: string }) {
  const dryRun = options.dryRun;
  const force = Boolean(options.force);
  const counts = initCounts();
  const breakdowns = initBreakdowns();
  const preview: QueueItemPreview[] = [];
  const warnings: string[] = [];
  const tz = process.env.OPS_TZ?.trim() || "Asia/Ho_Chi_Minh";
  const quietRangeRaw = process.env.OPS_QUIET_HOURS?.trim() || "21:00-08:00";
  const maxPerRun = envInt("OPS_MAX_PER_RUN", 200);
  const maxPerOwner = envInt("OPS_MAX_PER_OWNER", 50);
  const dedupeWindowDays = envInt("OPS_DEDUPE_WINDOW_DAYS", 1);
  const dedupeFrom = new Date(Date.now() - dedupeWindowDays * 24 * 60 * 60 * 1000);

  let automationLogId = "";
  try {
    await ensureOutboundSchema();
    await ensureDefaultMessageTemplates();

    const quietRange = parseQuietRange(quietRangeRaw);
    if (!quietRange) {
      warnings.push(`Định dạng OPS_QUIET_HOURS không hợp lệ: ${quietRangeRaw}`);
    }

    const quietBlocked = !force && quietRange ? isInQuietRange(nowInTz(tz), quietRange) : false;

    const defaultBranch =
      (await prisma.branch.findFirst({ where: { code: "DEFAULT" }, select: { id: true } })) ??
      (await prisma.branch.findFirst({ where: { isActive: true }, select: { id: true }, orderBy: { createdAt: "asc" } }));
    if (!defaultBranch?.id) {
      throw new Error("Không tìm thấy chi nhánh mặc định");
    }

    const log = await prisma.automationLog.create({
      data: {
        branchId: defaultBranch.id,
        channel: "system",
        templateKey: "cron.daily",
        milestone: "daily",
        status: dryRun ? "skipped" : "sent",
        payload: {
          runtimeStatus: "running",
          input: { dryRun, force, requestedBy: options.requestedBy ?? "cron", tz, quietHours: quietRangeRaw },
        },
      },
    });
    automationLogId = log.id;

    if (quietBlocked) {
      breakdowns.skippedReasons.quietHours = 1;
      const result = buildResult({
        dryRun,
        force,
        quietHoursBlocked: true,
        warning: "Đang trong giờ yên tĩnh, bỏ qua tác vụ.",
        warnings,
        counts,
        breakdowns,
        preview,
      });

      await prisma.automationLog.update({
        where: { id: automationLogId },
        data: {
          status: "skipped",
          payload: {
            runtimeStatus: "success",
            input: { dryRun, force, requestedBy: options.requestedBy ?? "cron", tz, quietHours: quietRangeRaw },
            output: { ...result.counts, breakdowns: result.breakdowns },
          },
        },
      });
      return result;
    }

    const generateResult = await runNotificationGenerate("finance", dryRun);
    counts.notificationsCreated = generateResult.created;
    counts.notificationsSkipped = Math.max(0, generateResult.preview.length - generateResult.created);

    if (!dryRun) {
      const notifications = await prisma.notification.findMany({
        where: { scope: "FINANCE", status: { in: ["NEW", "DOING"] } },
        include: {
          student: { include: { lead: { select: { id: true, fullName: true, phone: true, ownerId: true, branchId: true } } } },
          lead: { select: { id: true, fullName: true, phone: true, ownerId: true, branchId: true } },
        },
        orderBy: { createdAt: "desc" },
        take: Math.max(maxPerRun * 2, 200),
      });

      const ownerRunCount = new Map<string, number>();
      const ownerTotalCount = new Map<string, { ownerName: string; count: number }>();
      const items = notifications
        .map((item) => {
          const student = item.student;
          const lead = student?.lead ?? item.lead;
          const ownerId = student?.lead.ownerId ?? item.lead?.ownerId ?? null;
          const ownerName = ownerId || "Chưa phân công";
          const templateKey = pickTemplateKey(item.payload);
          const priority = computePriority(item.payload, item.dueAt);
          return { item, student, lead, ownerId, ownerName, templateKey, priority };
        })
        .sort((a, b) => {
          const rank = { HIGH: 0, MEDIUM: 1, LOW: 2 } as const;
          if (rank[a.priority] !== rank[b.priority]) return rank[a.priority] - rank[b.priority];
          const aDue = a.item.dueAt?.getTime() ?? Number.MAX_SAFE_INTEGER;
          const bDue = b.item.dueAt?.getTime() ?? Number.MAX_SAFE_INTEGER;
          return aDue - bDue;
        });

      const ownerIds = Array.from(new Set(items.map((i) => i.ownerId).filter((v): v is string => Boolean(v))));
      const owners = ownerIds.length
        ? await prisma.user.findMany({
            where: { id: { in: ownerIds } },
            select: { id: true, name: true, email: true },
          })
        : [];
      const ownerNameMap = new Map(owners.map((o) => [o.id, o.name || o.email]));

      for (const row of items) {
        try {
          if (counts.outboundQueued >= maxPerRun) {
            counts.outboundSkipped += 1;
            breakdowns.skippedReasons.caps += 1;
            if (preview.length < 10) {
              preview.push({
                notificationId: row.item.id,
                studentName: row.lead?.fullName || "Không rõ",
                ownerName: row.ownerId ? ownerNameMap.get(row.ownerId) || row.ownerName : row.ownerName,
                templateKey: row.templateKey,
                priority: row.priority,
                action: "skipped",
                reason: "Vượt giới hạn theo lượt chạy",
              });
            }
            continue;
          }

          if (!row.item.studentId || !row.student) {
            counts.outboundSkipped += 1;
            breakdowns.skippedReasons.missingStudent += 1;
            if (preview.length < 10) {
              preview.push({
                notificationId: row.item.id,
                studentName: row.lead?.fullName || "Không rõ",
                ownerName: row.ownerId ? ownerNameMap.get(row.ownerId) || row.ownerName : row.ownerName,
                templateKey: row.templateKey,
                priority: row.priority,
                action: "skipped",
                reason: "Thiếu học viên",
              });
            }
            continue;
          }

          if (!row.ownerId) {
            counts.outboundSkipped += 1;
            breakdowns.skippedReasons.missingOwner += 1;
            if (preview.length < 10) {
              preview.push({
                notificationId: row.item.id,
                studentName: row.lead?.fullName || "Không rõ",
                ownerName: row.ownerId ? ownerNameMap.get(row.ownerId) || row.ownerName : row.ownerName,
                templateKey: row.templateKey,
                priority: row.priority,
                action: "skipped",
                reason: "Thiếu người phụ trách",
              });
            }
            continue;
          }

          const ownerCount = ownerRunCount.get(row.ownerId) ?? 0;
          if (ownerCount >= maxPerOwner) {
            counts.outboundSkipped += 1;
            breakdowns.skippedReasons.caps += 1;
            if (preview.length < 10) {
              preview.push({
                notificationId: row.item.id,
                studentName: row.lead?.fullName || "Không rõ",
                ownerName: row.ownerId ? ownerNameMap.get(row.ownerId) || row.ownerName : row.ownerName,
                templateKey: row.templateKey,
                priority: row.priority,
                action: "skipped",
                reason: "Vượt giới hạn theo người phụ trách",
              });
            }
            continue;
          }

          const template = await prisma.messageTemplate.findUnique({ where: { key: row.templateKey } });
          if (!template || !template.isActive) {
            counts.outboundSkipped += 1;
            continue;
          }

          const to = row.lead?.phone ?? null;
          if (!to && (template.channel === "SMS" || template.channel === "ZALO")) {
            counts.outboundSkipped += 1;
            continue;
          }

          const existed = await prisma.outboundMessage.findFirst({
            where: {
              studentId: row.item.studentId,
              templateKey: row.templateKey,
              status: { in: ["QUEUED", "SENT"] as OutboundStatus[] },
              createdAt: { gte: dedupeFrom },
            },
            select: { id: true },
          });
          if (existed) {
            counts.outboundSkipped += 1;
            breakdowns.skippedReasons.dedupe += 1;
            if (preview.length < 10) {
              preview.push({
                notificationId: row.item.id,
                studentName: row.lead?.fullName || "Không rõ",
                ownerName: row.ownerId ? ownerNameMap.get(row.ownerId) || row.ownerName : row.ownerName,
                templateKey: row.templateKey,
                priority: row.priority,
                action: "skipped",
                reason: `Trùng trong ${dedupeWindowDays} ngày`,
              });
            }
            continue;
          }

          const payload = row.item.payload && typeof row.item.payload === "object" ? (row.item.payload as { remaining?: unknown }) : {};
          const renderedText = renderTemplate(template.body, {
            name: row.lead?.fullName ?? "Khách hàng",
            remaining: typeof payload.remaining === "number" ? payload.remaining.toLocaleString("vi-VN") : "",
            ownerName: row.ownerId ? ownerNameMap.get(row.ownerId) || row.ownerName : row.ownerName,
          });

          await prisma.outboundMessage.create({
            data: {
              channel: template.channel,
              to,
              templateKey: row.templateKey,
              renderedText,
              status: "QUEUED",
              priority: row.priority,
              branchId: row.lead?.branchId ?? defaultBranch.id,
              leadId: row.lead?.id ?? row.item.leadId,
              studentId: row.item.studentId,
              notificationId: row.item.id,
              nextAttemptAt: new Date(),
            },
          });

          counts.outboundQueued += 1;
          ownerRunCount.set(row.ownerId, ownerCount + 1);
          const ownerStat = ownerTotalCount.get(row.ownerId);
          ownerTotalCount.set(row.ownerId, {
            ownerName: ownerNameMap.get(row.ownerId) || row.ownerName,
            count: (ownerStat?.count ?? 0) + 1,
          });
          breakdowns.countsByPriority[row.priority] += 1;

          if (preview.length < 10) {
            preview.push({
              notificationId: row.item.id,
              studentName: row.lead?.fullName || "Không rõ",
              ownerName: row.ownerId ? ownerNameMap.get(row.ownerId) || row.ownerName : row.ownerName,
              templateKey: row.templateKey,
              priority: row.priority,
              action: "queued",
            });
          }
        } catch {
          counts.errors += 1;
        }
      }

      breakdowns.countsByOwner = Array.from(ownerTotalCount.entries())
        .map(([ownerId, data]) => ({ ownerId, ownerName: data.ownerName, count: data.count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);
    }

    const result = buildResult({
      dryRun,
      force,
      quietHoursBlocked: false,
      ...(warnings.length > 0 ? { warnings } : {}),
      counts,
      breakdowns,
      preview,
    });

    await prisma.automationLog.update({
      where: { id: automationLogId },
      data: {
        status: counts.errors > 0 ? "failed" : dryRun ? "skipped" : "sent",
        payload: {
          runtimeStatus: counts.errors > 0 ? "failed" : "success",
          input: { dryRun, force, requestedBy: options.requestedBy ?? "cron", tz, quietHours: quietRangeRaw },
          output: { ...result.counts, breakdowns: result.breakdowns, quietHoursBlocked: result.quietHoursBlocked },
        },
      },
    });

    if (counts.errors > 0) {
      throw new Error("Cron run has processing errors");
    }

    return result;
  } catch {
    if (automationLogId) {
      await prisma.automationLog.update({
        where: { id: automationLogId },
        data: {
          status: "failed",
          payload: {
            runtimeStatus: "failed",
            input: { dryRun, force, requestedBy: options.requestedBy ?? "cron", tz, quietHours: quietRangeRaw },
            output: { ...counts, breakdowns },
          },
        },
      }).catch(() => undefined);
    }
    throw new Error("CRON_DAILY_FAILED");
  }
}
