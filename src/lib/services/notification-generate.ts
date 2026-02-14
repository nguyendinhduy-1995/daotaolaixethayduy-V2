import type { NotificationPriority, NotificationScope, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ensureDefaultNotificationRules } from "@/lib/notifications-db";

export type GenerateScopeInput = "finance" | "followup" | "schedule";

export type FinanceCandidate = {
  scope: NotificationScope;
  priority: NotificationPriority;
  title: string;
  message: string;
  ownerId: string | null;
  leadId: string;
  studentId: string;
  dueAt: Date;
  payload: Prisma.InputJsonValue;
};

function dayDiff(from: Date, to: Date) {
  const diffMs = to.getTime() - from.getTime();
  return Math.floor(diffMs / (24 * 60 * 60 * 1000));
}

function todayStartHcm() {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const y = parts.find((p) => p.type === "year")?.value;
  const m = parts.find((p) => p.type === "month")?.value;
  const d = parts.find((p) => p.type === "day")?.value;
  return new Date(`${y}-${m}-${d}T00:00:00.000+07:00`);
}

export function isGenerateScope(value: unknown): value is GenerateScopeInput {
  return value === "finance" || value === "followup" || value === "schedule";
}

export async function buildFinanceCandidates() {
  await ensureDefaultNotificationRules();
  const rule = await prisma.notificationRule.findUnique({ where: { name: "finance-default" } });
  const config = (rule?.config as { highPriorityAfterDays?: number; mediumPriorityNoReceiptDays?: number; dedupeDays?: number } | null) || {};
  const highPriorityAfterDays = config.highPriorityAfterDays ?? 7;
  const mediumPriorityNoReceiptDays = config.mediumPriorityNoReceiptDays ?? 14;
  const dedupeDays = config.dedupeDays ?? 3;

  const students = await prisma.student.findMany({
    include: {
      lead: { select: { id: true, fullName: true, ownerId: true } },
      tuitionPlan: { select: { tuition: true } },
    },
  });

  const receiptAgg = await prisma.receipt.groupBy({
    by: ["studentId"],
    _sum: { amount: true },
    _max: { receivedAt: true },
  });
  const receiptMap = new Map(receiptAgg.map((row) => [row.studentId, { paid: row._sum.amount ?? 0, lastAt: row._max.receivedAt }]));

  const now = new Date();
  const dueAt = todayStartHcm();
  const dedupeFrom = new Date(now.getTime() - dedupeDays * 24 * 60 * 60 * 1000);
  const candidates: FinanceCandidate[] = [];

  for (const student of students) {
    const tuitionTotal = student.tuitionSnapshot ?? student.tuitionPlan?.tuition ?? 0;
    if (tuitionTotal <= 0) continue;
    const paidInfo = receiptMap.get(student.id);
    const paidTotal = paidInfo?.paid ?? 0;
    const remaining = Math.max(0, tuitionTotal - paidTotal);
    if (remaining <= 0) continue;

    const paid50 = paidTotal >= tuitionTotal * 0.5;
    const studentAgeDays = dayDiff(student.createdAt, now);
    const lastReceiptDays = paidInfo?.lastAt ? dayDiff(paidInfo.lastAt, now) : null;

    let priority: NotificationPriority = "LOW";
    if (!paid50 && studentAgeDays > highPriorityAfterDays) {
      priority = "HIGH";
    } else if (lastReceiptDays === null || lastReceiptDays > mediumPriorityNoReceiptDays) {
      priority = "MEDIUM";
    }

    const existed = await prisma.notification.findFirst({
      where: {
        scope: "FINANCE",
        studentId: student.id,
        status: { in: ["NEW", "DOING"] },
        createdAt: { gte: dedupeFrom },
      },
      select: { id: true },
    });
    if (existed) continue;

    candidates.push({
      scope: "FINANCE",
      priority,
      title: "Nhắc thu học phí",
      message: `${student.lead.fullName || "Học viên"} còn ${remaining.toLocaleString("vi-VN")} đ cần thu.`,
      ownerId: student.lead.ownerId,
      leadId: student.leadId,
      studentId: student.id,
      dueAt,
      payload: {
        tuitionTotal,
        paidTotal,
        remaining,
        paid50,
        studentAgeDays,
        lastReceiptDays,
      },
    });
  }

  return candidates;
}

export async function runNotificationGenerate(scope: GenerateScopeInput, dryRun: boolean) {
  if (scope !== "finance") {
    return { scope, dryRun, created: 0, preview: [] as FinanceCandidate[] };
  }

  const candidates = await buildFinanceCandidates();
  if (dryRun) {
    return { scope: "finance" as const, dryRun: true, created: 0, preview: candidates };
  }

  const created = [];
  for (const item of candidates) {
    const row = await prisma.notification.create({ data: item });
    created.push(row);
  }

  return { scope: "finance" as const, dryRun: false, created: created.length, preview: created };
}
