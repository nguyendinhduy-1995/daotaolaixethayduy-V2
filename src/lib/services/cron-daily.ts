import { prisma } from "@/lib/prisma";
import { ensureDefaultMessageTemplates, ensureOutboundSchema, renderTemplate } from "@/lib/outbound-db";
import { runNotificationGenerate } from "@/lib/services/notification-generate";

type CronCounts = {
  notificationsCreated: number;
  notificationsSkipped: number;
  outboundQueued: number;
  outboundSkipped: number;
  errors: number;
};

function dayRangeInHoChiMinh(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const y = parts.find((p) => p.type === "year")?.value;
  const m = parts.find((p) => p.type === "month")?.value;
  const d = parts.find((p) => p.type === "day")?.value;
  const start = new Date(`${y}-${m}-${d}T00:00:00.000+07:00`);
  const end = new Date(`${y}-${m}-${d}T23:59:59.999+07:00`);
  return { start, end };
}

function pickTemplateKey(payload: unknown) {
  const obj = payload && typeof payload === "object" ? (payload as { paid50?: unknown; lastReceiptDays?: unknown }) : {};
  const paid50 = Boolean(obj.paid50);
  const lastReceiptDays = typeof obj.lastReceiptDays === "number" ? obj.lastReceiptDays : null;
  if (!paid50) return "remind_paid50";
  if (lastReceiptDays !== null && lastReceiptDays > 14) return "remind_remaining";
  return "remind_remaining";
}

export async function runDailyCron(options: { dryRun: boolean; requestedBy?: string }) {
  const counts: CronCounts = {
    notificationsCreated: 0,
    notificationsSkipped: 0,
    outboundQueued: 0,
    outboundSkipped: 0,
    errors: 0,
  };

  let automationLogId = "";
  try {
    await ensureOutboundSchema();
    await ensureDefaultMessageTemplates();

    const generateResult = await runNotificationGenerate("finance", options.dryRun);
    counts.notificationsCreated = generateResult.created;
    counts.notificationsSkipped = Math.max(0, generateResult.preview.length - generateResult.created);

    const log = await prisma.automationLog.create({
      data: {
        channel: "system",
        templateKey: "cron.daily",
        milestone: "daily",
        status: options.dryRun ? "skipped" : "sent",
        payload: {
          runtimeStatus: "running",
          input: { dryRun: options.dryRun, requestedBy: options.requestedBy ?? "cron" },
        },
      },
    });
    automationLogId = log.id;

    if (!options.dryRun) {
      const notifications = await prisma.notification.findMany({
        where: {
          scope: "FINANCE",
          status: { in: ["NEW", "DOING"] },
        },
        include: {
          student: { include: { lead: { select: { id: true, fullName: true, phone: true } } } },
          lead: { select: { id: true, fullName: true, phone: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 200,
      });

      const { start, end } = dayRangeInHoChiMinh();

      for (const item of notifications) {
        try {
          const templateKey = pickTemplateKey(item.payload);
          const template = await prisma.messageTemplate.findUnique({ where: { key: templateKey } });
          if (!template || !template.isActive) {
            counts.outboundSkipped += 1;
            continue;
          }

          const student = item.student;
          const lead = student?.lead ?? item.lead;
          const to = lead?.phone ?? null;

          if (!to && (template.channel === "SMS" || template.channel === "ZALO")) {
            counts.outboundSkipped += 1;
            continue;
          }

          const existed = item.studentId
            ? await prisma.outboundMessage.findFirst({
                where: {
                  studentId: item.studentId,
                  templateKey,
                  status: { in: ["QUEUED", "SENT"] },
                  createdAt: { gte: start, lte: end },
                },
                select: { id: true },
              })
            : null;
          if (existed) {
            counts.outboundSkipped += 1;
            continue;
          }

          const payload = item.payload && typeof item.payload === "object" ? (item.payload as { remaining?: unknown }) : {};
          const renderedText = renderTemplate(template.body, {
            name: lead?.fullName ?? "Khách hàng",
            remaining: typeof payload.remaining === "number" ? payload.remaining.toLocaleString("vi-VN") : "",
            ownerName: "",
          });

          await prisma.outboundMessage.create({
            data: {
              channel: template.channel,
              to,
              templateKey,
              renderedText,
              status: "QUEUED",
              leadId: lead?.id ?? item.leadId,
              studentId: item.studentId,
              notificationId: item.id,
              nextAttemptAt: new Date(),
            },
          });

          counts.outboundQueued += 1;
        } catch {
          counts.errors += 1;
        }
      }
    }

    if (automationLogId) {
      await prisma.automationLog.update({
        where: { id: automationLogId },
        data: {
          status: options.dryRun ? "skipped" : counts.errors > 0 ? "failed" : "sent",
          payload: {
            runtimeStatus: counts.errors > 0 ? "failed" : "success",
            input: { dryRun: options.dryRun, requestedBy: options.requestedBy ?? "cron" },
            output: counts,
          },
        },
      });
    }

    return { ok: true, ...counts };
  } catch {
    if (automationLogId) {
      await prisma.automationLog.update({
        where: { id: automationLogId },
        data: {
          status: "failed",
          payload: {
            runtimeStatus: "failed",
            output: counts,
          },
        },
      }).catch(() => undefined);
    }
    return { ok: false, ...counts };
  }
}
