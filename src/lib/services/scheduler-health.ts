import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isAdminRole, isTelesalesRole } from "@/lib/admin-auth";

type AuthInput = {
  sub: string;
  role: string;
};

type AutomationSummary = {
  lastRunAt: string | null;
  deliveryStatus: string | null;
  runtimeStatus: string | null;
  output: Record<string, unknown>;
};

function safeObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function extractAutomationSummary(log: { sentAt: Date; status: string; payload: unknown } | null): AutomationSummary {
  if (!log) {
    return {
      lastRunAt: null,
      deliveryStatus: null,
      runtimeStatus: null,
      output: {},
    };
  }
  const payload = safeObject(log.payload);
  const output = safeObject(payload.output);
  return {
    lastRunAt: log.sentAt.toISOString(),
    deliveryStatus: log.status,
    runtimeStatus: typeof payload.runtimeStatus === "string" ? payload.runtimeStatus : null,
    output,
  };
}

function currentTimeInTz(tz: string) {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  })
    .format(new Date())
    .replace(" ", "T");
}

export async function getSchedulerHealth(input: AuthInput) {
  const isAdmin = isAdminRole(input.role);
  const isTele = isTelesalesRole(input.role);
  const now = new Date();
  const sent24hFrom = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const soonUntil = new Date(now.getTime() + 15 * 60 * 1000);
  const tz = process.env.WORKER_TZ?.trim() || process.env.OPS_TZ?.trim() || "Asia/Ho_Chi_Minh";

  const scopedWhere: Prisma.OutboundMessageWhereInput =
    isAdmin || !isTele
      ? {}
      : {
          OR: [{ lead: { ownerId: input.sub } }, { student: { lead: { ownerId: input.sub } } }],
        };

  const [queued, failed, sentLast24h, nextAttemptSoonCount, byPriorityRaw, byOwnerRaw, ownerUsers, latestWorkerLog, latestCronLog] =
    await Promise.all([
      prisma.outboundMessage.count({
        where: { ...scopedWhere, status: "QUEUED" },
      }),
      prisma.outboundMessage.count({
        where: { ...scopedWhere, status: "FAILED" },
      }),
      prisma.outboundMessage.count({
        where: {
          ...scopedWhere,
          status: "SENT",
          OR: [{ sentAt: { gte: sent24hFrom } }, { dispatchedAt: { gte: sent24hFrom } }],
        },
      }),
      prisma.outboundMessage.count({
        where: {
          ...scopedWhere,
          status: { in: ["QUEUED", "FAILED"] },
          nextAttemptAt: { gte: now, lte: soonUntil },
        },
      }),
      prisma.outboundMessage.groupBy({
        by: ["priority"],
        where: { ...scopedWhere, status: "QUEUED" },
        _count: { _all: true },
      }),
      isAdmin
        ? prisma.outboundMessage.findMany({
            where: { status: "QUEUED" },
            select: {
              lead: { select: { ownerId: true } },
              student: { select: { lead: { select: { ownerId: true } } } },
            },
            take: 1000,
          })
        : Promise.resolve([]),
      isAdmin
        ? prisma.user.findMany({
            select: { id: true, name: true, email: true },
          })
        : Promise.resolve([]),
      prisma.automationLog.findFirst({
        where: { milestone: "outbound-worker" },
        orderBy: { sentAt: "desc" },
      }),
      prisma.automationLog.findFirst({
        where: { milestone: { in: ["cron-daily", "daily"] } },
        orderBy: { sentAt: "desc" },
      }),
    ]);

  const byPriority = { HIGH: 0, MEDIUM: 0, LOW: 0 };
  for (const row of byPriorityRaw) {
    if (row.priority === "HIGH") byPriority.HIGH = row._count._all;
    if (row.priority === "MEDIUM") byPriority.MEDIUM = row._count._all;
    if (row.priority === "LOW") byPriority.LOW = row._count._all;
  }

  const byOwner: Array<{ ownerId: string; ownerName: string; count: number }> = [];
  if (isAdmin) {
    const ownerCountMap = new Map<string, number>();
    for (const row of byOwnerRaw) {
      const ownerId = row.student?.lead.ownerId ?? row.lead?.ownerId ?? null;
      if (!ownerId) continue;
      ownerCountMap.set(ownerId, (ownerCountMap.get(ownerId) ?? 0) + 1);
    }
    const userMap = new Map(ownerUsers.map((u) => [u.id, u.name || u.email]));
    byOwner.push(
      ...Array.from(ownerCountMap.entries())
        .map(([ownerId, count]) => ({
          ownerId,
          ownerName: userMap.get(ownerId) || ownerId,
          count,
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10)
    );
  }

  const warnings: string[] = [];
  if (!process.env.WORKER_SECRET?.trim()) {
    warnings.push("Thiếu WORKER_SECRET: n8n không gọi được worker.");
  }
  if (!process.env.N8N_WEBHOOK_URL?.trim()) {
    warnings.push("Chưa cấu hình N8N_WEBHOOK_URL: hệ thống đang gửi mock nội bộ.");
  }
  if (!process.env.CRON_SECRET?.trim()) {
    warnings.push("Thiếu CRON_SECRET: cron nội bộ chưa sẵn sàng.");
  }

  return {
    serverTime: new Date().toISOString(),
    serverTimeTz: currentTimeInTz(tz),
    tz,
    outbound: {
      queued,
      failed,
      sentLast24h,
      nextAttemptSoonCount,
      byPriority,
      byOwner,
    },
    automation: {
      outboundWorker: extractAutomationSummary(latestWorkerLog),
      cronDaily: extractAutomationSummary(latestCronLog),
    },
    warnings,
  };
}
