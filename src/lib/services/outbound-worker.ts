import { randomUUID } from "crypto";
import type { OutboundPriority, OutboundStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ensureOutboundSchema } from "@/lib/outbound-db";

type OwnerInfo = { ownerId: string | null; ownerName: string };

type WorkerInput = {
  dryRun?: boolean;
  batchSize?: number;
  retryFailedOnly?: boolean;
  includeFailed?: boolean;
  force?: boolean;
  concurrency?: number;
  requestedBy?: string;
  logRun?: boolean;
};

type WorkerResult = {
  ok: boolean;
  dryRun: boolean;
  processed: number;
  sent: number;
  failed: number;
  skipped: number;
  rateLimited: number;
  remainingEstimate: number;
  breakdownByPriority: Record<OutboundPriority, number>;
  breakdownByOwner: Array<{ ownerId: string; ownerName: string; count: number }>;
  webhookEnabled: boolean;
  warnings?: string[];
};

type LeasedOutboundItem = {
  id: string;
  channel: string;
  to: string | null;
  templateKey: string;
  renderedText: string;
  status: OutboundStatus;
  priority: OutboundPriority;
  leadId: string | null;
  studentId: string | null;
  notificationId: string | null;
  retryCount: number;
  createdAt: Date;
  lead: { id: string; ownerId: string | null; fullName: string | null } | null;
  student: { lead: { id: string; ownerId: string | null; fullName: string | null } } | null;
};

const PRIORITY_RANK: Record<OutboundPriority, number> = { HIGH: 3, MEDIUM: 2, LOW: 1 };

function envInt(name: string, fallback: number) {
  const raw = process.env[name];
  if (!raw) return fallback;
  const v = Number(raw);
  if (!Number.isInteger(v) || v <= 0) return fallback;
  return v;
}

function nextBackoffWithJitter(retryCount: number) {
  const minute = 60 * 1000;
  const steps = [2 * minute, 10 * minute, 60 * minute];
  const base = steps[Math.max(0, Math.min(retryCount - 1, steps.length - 1))];
  const jitter = Math.floor(base * (Math.random() * 0.4 - 0.2));
  return new Date(Date.now() + base + jitter);
}

function parseOwner(msg: {
  lead?: { ownerId: string | null; fullName: string | null } | null;
  student?: { lead: { ownerId: string | null; fullName: string | null } } | null;
}): OwnerInfo {
  const ownerId = msg.student?.lead.ownerId ?? msg.lead?.ownerId ?? null;
  return {
    ownerId,
    ownerName: ownerId ?? "Chưa phân công",
  };
}

async function getRateUsage(windowFrom: Date) {
  const items = await prisma.outboundMessage.findMany({
    where: { dispatchedAt: { gte: windowFrom } },
    include: {
      lead: { select: { ownerId: true } },
      student: { include: { lead: { select: { ownerId: true } } } },
    },
    take: 1000,
  });

  const perOwner = new Map<string, number>();
  for (const item of items) {
    const ownerId = item.student?.lead.ownerId ?? item.lead?.ownerId ?? null;
    if (!ownerId) continue;
    perOwner.set(ownerId, (perOwner.get(ownerId) ?? 0) + 1);
  }

  return { global: items.length, perOwner };
}

export async function selectEligible(input: WorkerInput) {
  await ensureOutboundSchema();
  const now = new Date();
  const maxBatch = envInt("WORKER_BATCH_SIZE", 50);
  const batchSize = Math.min(Math.max(1, input.batchSize ?? maxBatch), 200);
  const statuses: OutboundStatus[] = input.retryFailedOnly ? ["FAILED"] : input.includeFailed ? ["QUEUED", "FAILED"] : ["QUEUED"];

  const where: Prisma.OutboundMessageWhereInput = {
    status: { in: statuses },
    retryCount: { lt: 3 },
    AND: [
      { OR: [{ leaseExpiresAt: null }, { leaseExpiresAt: { lte: now } }] },
      ...(input.force ? [] : [{ OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }] }]),
    ],
  };

  const fetched = await prisma.outboundMessage.findMany({
    where,
    include: {
      lead: { select: { id: true, ownerId: true, fullName: true } },
      student: { include: { lead: { select: { id: true, ownerId: true, fullName: true } } } },
    },
    orderBy: [{ createdAt: "asc" }],
    take: batchSize * 3,
  });

  const sorted = fetched.sort((a, b) => {
    const pa = PRIORITY_RANK[a.priority as OutboundPriority] ?? 1;
    const pb = PRIORITY_RANK[b.priority as OutboundPriority] ?? 1;
    if (pa !== pb) return pb - pa;
    const na = a.nextAttemptAt?.getTime() ?? 0;
    const nb = b.nextAttemptAt?.getTime() ?? 0;
    if (na !== nb) return na - nb;
    return a.createdAt.getTime() - b.createdAt.getTime();
  });

  return sorted.slice(0, batchSize);
}

export async function leaseBatch(ids: string[], leaseSeconds: number) {
  if (ids.length === 0) return { leaseId: "", items: [] as LeasedOutboundItem[] };
  const now = new Date();
  const leaseId = randomUUID();
  const leaseExpiresAt = new Date(now.getTime() + leaseSeconds * 1000);
  await prisma.$transaction(async (tx) => {
    await tx.outboundMessage.updateMany({
      where: {
        id: { in: ids },
        OR: [{ leaseExpiresAt: null }, { leaseExpiresAt: { lte: now } }],
      },
      data: { leaseId, leaseExpiresAt },
    });
  });

  const items = await prisma.outboundMessage.findMany({
    where: { leaseId },
    include: {
      lead: { select: { id: true, ownerId: true, fullName: true } },
      student: { include: { lead: { select: { id: true, ownerId: true, fullName: true } } } },
    },
  });
  return { leaseId, items: items as LeasedOutboundItem[] };
}

export async function dispatchOne(message: {
  id: string;
  channel: string;
  to: string | null;
  templateKey: string;
  renderedText: string;
  leadId: string | null;
  studentId: string | null;
  notificationId: string | null;
  createdAt: Date;
  retryCount: number;
}) {
  const webhookUrl = process.env.N8N_WEBHOOK_URL?.trim();
  const dispatchedAt = new Date();
  if (!webhookUrl) {
    await prisma.outboundMessage.update({
      where: { id: message.id },
      data: {
        status: "SENT",
        sentAt: dispatchedAt,
        dispatchedAt,
        error: null,
        nextAttemptAt: null,
        leaseId: null,
        leaseExpiresAt: null,
      },
    });
    return { status: "SENT" as const, webhookEnabled: false };
  }

  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messageId: message.id,
        channel: message.channel,
        to: message.to,
        text: message.renderedText,
        leadId: message.leadId,
        studentId: message.studentId,
        notificationId: message.notificationId,
        templateKey: message.templateKey,
        createdAt: message.createdAt.toISOString(),
      }),
    });
    if (res.ok) {
      await prisma.outboundMessage.update({
        where: { id: message.id },
        data: {
          status: "QUEUED",
          dispatchedAt,
          error: null,
          nextAttemptAt: nextBackoffWithJitter(1),
          leaseId: null,
          leaseExpiresAt: null,
        },
      });
      return { status: "QUEUED" as const, webhookEnabled: true };
    }

    const nextRetry = message.retryCount + 1;
    await prisma.outboundMessage.update({
      where: { id: message.id },
      data: {
        status: "FAILED",
        dispatchedAt,
        retryCount: nextRetry,
        error: `Webhook status ${res.status}`,
        nextAttemptAt: nextBackoffWithJitter(nextRetry),
        leaseId: null,
        leaseExpiresAt: null,
      },
    });
    return { status: "FAILED" as const, webhookEnabled: true };
  } catch (error) {
    const nextRetry = message.retryCount + 1;
    await prisma.outboundMessage.update({
      where: { id: message.id },
      data: {
        status: "FAILED",
        dispatchedAt,
        retryCount: nextRetry,
        error: error instanceof Error ? error.message.slice(0, 500) : "Dispatch error",
        nextAttemptAt: nextBackoffWithJitter(nextRetry),
        leaseId: null,
        leaseExpiresAt: null,
      },
    });
    return { status: "FAILED" as const, webhookEnabled: true };
  }
}

async function mapConcurrent<T>(items: T[], limit: number, handler: (item: T) => Promise<void>) {
  const workers = Array.from({ length: Math.max(1, limit) }, async (_, workerIndex) => {
    for (let i = workerIndex; i < items.length; i += limit) {
      await handler(items[i]);
    }
  });
  await Promise.all(workers);
}

function toTopOwner(ownerMap: Map<string, { ownerName: string; count: number }>) {
  return Array.from(ownerMap.entries())
    .map(([ownerId, row]) => ({ ownerId, ownerName: row.ownerName, count: row.count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
}

export async function runWorkerOnce(input: WorkerInput): Promise<WorkerResult> {
  const dryRun = Boolean(input.dryRun);
  const concurrency = Math.min(Math.max(1, input.concurrency ?? envInt("WORKER_CONCURRENCY", 5)), 20);
  const rateGlobal = envInt("WORKER_RATE_LIMIT_PER_MIN", 120);
  const ratePerOwner = envInt("WORKER_RATE_LIMIT_PER_OWNER_PER_MIN", 30);
  const leaseSeconds = envInt("WORKER_LEASE_SECONDS", 60);

  const warnings: string[] = [];
  const selected = await selectEligible(input);
  const remainingEstimate = Math.max(0, selected.length - (input.batchSize ?? envInt("WORKER_BATCH_SIZE", 50)));
  const breakdownByPriority: Record<OutboundPriority, number> = { HIGH: 0, MEDIUM: 0, LOW: 0 };
  const ownerMap = new Map<string, { ownerName: string; count: number }>();

  const windowFrom = new Date(Date.now() - 60 * 1000);
  const usage = await getRateUsage(windowFrom);
  let globalBudget = Math.max(0, rateGlobal - usage.global);
  const ownerBudget = new Map<string, number>();

  if (dryRun) {
    let allowed = 0;
    let rateLimited = 0;
    for (const item of selected) {
      const owner = parseOwner(item);
      if (globalBudget <= 0) {
        rateLimited += 1;
        continue;
      }
      if (owner.ownerId) {
        const used = usage.perOwner.get(owner.ownerId) ?? 0;
        const remain = ownerBudget.has(owner.ownerId) ? ownerBudget.get(owner.ownerId)! : Math.max(0, ratePerOwner - used);
        if (remain <= 0) {
          rateLimited += 1;
          continue;
        }
        ownerBudget.set(owner.ownerId, remain - 1);
      }
      globalBudget -= 1;
      allowed += 1;
      breakdownByPriority[item.priority as OutboundPriority] += 1;
      if (owner.ownerId) {
        const row = ownerMap.get(owner.ownerId) ?? { ownerName: owner.ownerName, count: 0 };
        row.count += 1;
        ownerMap.set(owner.ownerId, row);
      }
    }
    const dryResult: WorkerResult = {
      ok: true,
      dryRun: true,
      processed: allowed,
      sent: 0,
      failed: 0,
      skipped: 0,
      rateLimited,
      remainingEstimate,
      breakdownByPriority,
      breakdownByOwner: toTopOwner(ownerMap),
      webhookEnabled: Boolean(process.env.N8N_WEBHOOK_URL?.trim()),
      ...(warnings.length ? { warnings } : {}),
    };
    if (input.logRun !== false) {
      await prisma.automationLog.create({
        data: {
          channel: "system",
          templateKey: "worker.outbound",
          milestone: "outbound-worker",
          status: "skipped",
          payload: {
            runtimeStatus: "success",
            input: {
              dryRun: true,
              retryFailedOnly: Boolean(input.retryFailedOnly),
              force: Boolean(input.force),
              batchSize: input.batchSize ?? envInt("WORKER_BATCH_SIZE", 50),
              concurrency,
              requestedBy: input.requestedBy ?? "worker-secret",
            },
            output: dryResult,
          },
        },
      });
    }
    return dryResult;
  }

  const lease = await leaseBatch(
    selected.map((i) => i.id),
    leaseSeconds
  );
  const leasedItems = lease.items;

  let processed = 0;
  let sent = 0;
  let failed = 0;
  let skipped = 0;
  let rateLimited = 0;
  const webhookEnabled = Boolean(process.env.N8N_WEBHOOK_URL?.trim());
  const lockedForRelease: string[] = [];

  const execItems: typeof leasedItems = [];
  for (const item of leasedItems) {
    const owner = parseOwner(item);
    if (globalBudget <= 0) {
      rateLimited += 1;
      lockedForRelease.push(item.id);
      continue;
    }
    if (owner.ownerId) {
      const used = usage.perOwner.get(owner.ownerId) ?? 0;
      const remain = ownerBudget.has(owner.ownerId) ? ownerBudget.get(owner.ownerId)! : Math.max(0, ratePerOwner - used);
      if (remain <= 0) {
        rateLimited += 1;
        lockedForRelease.push(item.id);
        continue;
      }
      ownerBudget.set(owner.ownerId, remain - 1);
      const row = ownerMap.get(owner.ownerId) ?? { ownerName: owner.ownerName, count: 0 };
      row.count += 1;
      ownerMap.set(owner.ownerId, row);
    }
    globalBudget -= 1;
    execItems.push(item);
  }

  if (lockedForRelease.length > 0) {
    await prisma.outboundMessage.updateMany({
      where: { id: { in: lockedForRelease } },
      data: { leaseId: null, leaseExpiresAt: null },
    });
  }

  await mapConcurrent(execItems, concurrency, async (item) => {
    const result = await dispatchOne(item);
    processed += 1;
    breakdownByPriority[item.priority as OutboundPriority] += 1;
    if (result.status === "SENT") sent += 1;
    else if (result.status === "FAILED") failed += 1;
    else skipped += 1;
  });

  if (input.logRun !== false) {
    await prisma.automationLog.create({
      data: {
        channel: "system",
        templateKey: "worker.outbound",
        milestone: "outbound-worker",
        status: failed > 0 ? "failed" : "sent",
        payload: {
          runtimeStatus: failed > 0 ? "failed" : "success",
          input: {
            dryRun,
            retryFailedOnly: Boolean(input.retryFailedOnly),
            force: Boolean(input.force),
            batchSize: input.batchSize ?? envInt("WORKER_BATCH_SIZE", 50),
            concurrency,
            requestedBy: input.requestedBy ?? "worker-secret",
          },
          output: {
            processed,
            sent,
            failed,
            skipped,
            rateLimited,
            remainingEstimate,
            breakdownByPriority,
            breakdownByOwner: toTopOwner(ownerMap),
          },
        },
      },
    });
  }

  return {
    ok: true,
    dryRun,
    processed,
    sent,
    failed,
    skipped,
    rateLimited,
    remainingEstimate,
    breakdownByPriority,
    breakdownByOwner: toTopOwner(ownerMap),
    webhookEnabled,
    ...(warnings.length ? { warnings } : {}),
  };
}
