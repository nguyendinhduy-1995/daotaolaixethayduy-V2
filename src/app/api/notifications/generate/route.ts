import { NextResponse } from "next/server";
import type { NotificationPriority, NotificationScope, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { jsonError } from "@/lib/api-response";
import { requireRouteAuth } from "@/lib/route-auth";
import { requireAdminRole } from "@/lib/admin-auth";
import { ensureDefaultNotificationRules } from "@/lib/notifications-db";

type GenerateScopeInput = "finance" | "followup" | "schedule";

type FinanceCandidate = {
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

function isGenerateScope(value: unknown): value is GenerateScopeInput {
  return value === "finance" || value === "followup" || value === "schedule";
}

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

async function buildFinanceCandidates() {
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

export async function POST(req: Request) {
  const authResult = requireRouteAuth(req);
  if (authResult.error) return authResult.error;
  const adminError = requireAdminRole(authResult.auth.role);
  if (adminError) return adminError;

  try {
    await ensureDefaultNotificationRules();

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object" || !isGenerateScope(body.scope)) {
      return jsonError(400, "VALIDATION_ERROR", "Invalid generate input");
    }
    if (body.dryRun !== undefined && typeof body.dryRun !== "boolean") {
      return jsonError(400, "VALIDATION_ERROR", "dryRun must be boolean");
    }

    if (body.scope !== "finance") {
      return NextResponse.json({ scope: body.scope, dryRun: Boolean(body.dryRun), created: 0, preview: [] });
    }

    const candidates = await buildFinanceCandidates();

    if (body.dryRun) {
      return NextResponse.json({ scope: "finance", dryRun: true, created: 0, preview: candidates });
    }

    const created = [];
    for (const item of candidates) {
      const row = await prisma.notification.create({ data: item });
      created.push(row);
    }

    return NextResponse.json({ scope: "finance", dryRun: false, created: created.length, preview: created });
  } catch {
    return jsonError(500, "INTERNAL_ERROR", "Internal server error");
  }
}
