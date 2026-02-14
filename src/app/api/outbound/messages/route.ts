import { NextResponse } from "next/server";
import type { OutboundChannel, OutboundStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { jsonError } from "@/lib/api-response";
import { requireRouteAuth } from "@/lib/route-auth";
import { isAdminRole } from "@/lib/admin-auth";
import { ensureOutboundSchema, renderTemplate } from "@/lib/outbound-db";
import { KpiDateError, resolveKpiDateParam } from "@/lib/services/kpi-daily";

const CHANNELS: OutboundChannel[] = ["ZALO", "FB", "SMS", "CALL_NOTE"];
const STATUSES: OutboundStatus[] = ["QUEUED", "SENT", "FAILED", "SKIPPED"];

function isChannel(value: unknown): value is OutboundChannel {
  return typeof value === "string" && CHANNELS.includes(value as OutboundChannel);
}

function isStatus(value: string | null): value is OutboundStatus {
  return value !== null && STATUSES.includes(value as OutboundStatus);
}

function parsePositiveInt(value: string | null, fallback: number, max = 100) {
  if (value === null) return fallback;
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) throw new Error("INVALID_PAGINATION");
  return Math.min(n, max);
}

function dayRangeInHoChiMinh(dateStr: string) {
  const start = new Date(`${dateStr}T00:00:00.000+07:00`);
  const end = new Date(`${dateStr}T23:59:59.999+07:00`);
  return { start, end };
}

function todayRangeInHoChiMinh() {
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
  return dayRangeInHoChiMinh(`${y}-${m}-${d}`);
}

function nowUtc() {
  return new Date();
}

function toVariables(input: unknown) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return {};
  return Object.fromEntries(
    Object.entries(input as Record<string, unknown>).map(([k, v]) => [k, v === null ? "" : v])
  );
}

export async function GET(req: Request) {
  const authResult = requireRouteAuth(req);
  if (authResult.error) return authResult.error;

  try {
    await ensureOutboundSchema();
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const channel = searchParams.get("channel");
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const q = searchParams.get("q")?.trim();
    const leadId = searchParams.get("leadId");
    const studentId = searchParams.get("studentId");
    const page = parsePositiveInt(searchParams.get("page"), 1);
    const pageSize = parsePositiveInt(searchParams.get("pageSize"), 20);

    if (status !== null && !isStatus(status)) {
      return jsonError(400, "VALIDATION_ERROR", "Invalid status");
    }
    if (channel !== null && !isChannel(channel)) {
      return jsonError(400, "VALIDATION_ERROR", "Invalid channel");
    }

    const createdAt: Prisma.DateTimeFilter = {};
    if (from) createdAt.gte = dayRangeInHoChiMinh(resolveKpiDateParam(from)).start;
    if (to) createdAt.lte = dayRangeInHoChiMinh(resolveKpiDateParam(to)).end;

    const andClauses: Prisma.OutboundMessageWhereInput[] = [];
    if (q) {
      andClauses.push({
        OR: [
          { templateKey: { contains: q, mode: "insensitive" } },
          { renderedText: { contains: q, mode: "insensitive" } },
          { to: { contains: q, mode: "insensitive" } },
        ],
      });
    }
    if (!isAdminRole(authResult.auth.role)) {
      andClauses.push({
        OR: [
          { lead: { ownerId: authResult.auth.sub } },
          { student: { lead: { ownerId: authResult.auth.sub } } },
        ],
      });
    }

    const where: Prisma.OutboundMessageWhereInput = {
      ...(status ? { status } : {}),
      ...(channel ? { channel } : {}),
      ...(leadId ? { leadId } : {}),
      ...(studentId ? { studentId } : {}),
      ...(from || to ? { createdAt } : {}),
      ...(andClauses.length > 0 ? { AND: andClauses } : {}),
    };

    const [items, total] = await Promise.all([
      prisma.outboundMessage.findMany({
        where,
        include: {
          lead: { select: { id: true, fullName: true, phone: true, ownerId: true } },
          student: { include: { lead: { select: { id: true, fullName: true, phone: true, ownerId: true } } } },
          notification: { select: { id: true, title: true, status: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.outboundMessage.count({ where }),
    ]);

    return NextResponse.json({ items, page, pageSize, total });
  } catch (error) {
    if (error instanceof KpiDateError) {
      return jsonError(400, "VALIDATION_ERROR", error.message);
    }
    if (error instanceof Error && error.message === "INVALID_PAGINATION") {
      return jsonError(400, "VALIDATION_ERROR", "Invalid pagination");
    }
    return jsonError(500, "INTERNAL_ERROR", "Internal server error");
  }
}

export async function POST(req: Request) {
  const authResult = requireRouteAuth(req);
  if (authResult.error) return authResult.error;

  try {
    await ensureOutboundSchema();
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return jsonError(400, "VALIDATION_ERROR", "Invalid JSON body");
    }
    if (!isChannel(body.channel)) {
      return jsonError(400, "VALIDATION_ERROR", "Invalid channel");
    }
    if (!body.templateKey || typeof body.templateKey !== "string") {
      return jsonError(400, "VALIDATION_ERROR", "templateKey is required");
    }

    const template = await prisma.messageTemplate.findUnique({
      where: { key: body.templateKey },
    });
    if (!template || !template.isActive) {
      return jsonError(404, "NOT_FOUND", "Template not found");
    }

    let lead: { id: string; fullName: string | null; phone: string | null; ownerId: string | null } | null = null;
    let student:
      | {
          id: string;
          leadId: string;
          lead: { id: string; fullName: string | null; phone: string | null; ownerId: string | null };
        }
      | null = null;

    if (typeof body.leadId === "string") {
      lead = await prisma.lead.findUnique({
        where: { id: body.leadId },
        select: { id: true, fullName: true, phone: true, ownerId: true },
      });
      if (!lead) return jsonError(404, "NOT_FOUND", "Lead not found");
    }

    if (typeof body.studentId === "string") {
      student = await prisma.student.findUnique({
        where: { id: body.studentId },
        include: { lead: { select: { id: true, fullName: true, phone: true, ownerId: true } } },
      });
      if (!student) return jsonError(404, "NOT_FOUND", "Student not found");
      if (!lead) lead = student.lead;
    }

    let notification:
      | {
          id: string;
          leadId: string | null;
          studentId: string | null;
          ownerId: string | null;
          lead: { ownerId: string | null } | null;
          student: { lead: { ownerId: string | null } } | null;
        }
      | null = null;
    if (typeof body.notificationId === "string") {
      notification = await prisma.notification.findUnique({
        where: { id: body.notificationId },
        include: {
          lead: { select: { ownerId: true } },
          student: { include: { lead: { select: { ownerId: true } } } },
        },
      });
      if (!notification) return jsonError(404, "NOT_FOUND", "Notification not found");
      if (!lead && notification.leadId) {
        lead = await prisma.lead.findUnique({
          where: { id: notification.leadId },
          select: { id: true, fullName: true, phone: true, ownerId: true },
        });
      }
      if (!student && notification.studentId) {
        student = await prisma.student.findUnique({
          where: { id: notification.studentId },
          include: { lead: { select: { id: true, fullName: true, phone: true, ownerId: true } } },
        });
        if (!lead && student) lead = student.lead;
      }
    }

    if (!isAdminRole(authResult.auth.role)) {
      const inScope =
        lead?.ownerId === authResult.auth.sub ||
        student?.lead.ownerId === authResult.auth.sub ||
        notification?.ownerId === authResult.auth.sub ||
        notification?.lead?.ownerId === authResult.auth.sub ||
        notification?.student?.lead.ownerId === authResult.auth.sub;
      if (!inScope) return jsonError(403, "AUTH_FORBIDDEN", "Forbidden");
    }

    const contactPhone = student?.lead.phone || lead?.phone || null;
    const targetTo =
      typeof body.to === "string" && body.to.trim()
        ? body.to.trim()
        : body.channel === "ZALO" || body.channel === "SMS"
          ? contactPhone
          : null;

    if ((body.channel === "ZALO" || body.channel === "SMS") && !targetTo) {
      return jsonError(400, "VALIDATION_ERROR", "Missing recipient phone");
    }

    const variables = {
      name: student?.lead.fullName || lead?.fullName || "",
      phone: contactPhone || "",
      ownerName: "",
      ...(toVariables(body.variables)),
    };

    const renderedText = renderTemplate(template.body, variables);

    const dedupeRange = todayRangeInHoChiMinh();
    if (student?.id) {
      const existing = await prisma.outboundMessage.findFirst({
        where: {
          studentId: student.id,
          templateKey: template.key,
          status: { in: ["QUEUED", "SENT"] },
          createdAt: { gte: dedupeRange.start, lte: dedupeRange.end },
        },
        select: { id: true },
      });
      if (existing) {
        const skipped = await prisma.outboundMessage.create({
          data: {
            channel: body.channel,
            to: targetTo,
            templateKey: template.key,
            renderedText,
            status: "SKIPPED",
            priority: "MEDIUM",
            error: "Bỏ qua do trùng template trong ngày",
            leadId: lead?.id ?? null,
            studentId: student.id,
            notificationId: typeof body.notificationId === "string" ? body.notificationId : null,
            nextAttemptAt: null,
          },
        });
        return NextResponse.json({ outboundMessage: skipped, skipped: true, reason: "DUPLICATE_TODAY" });
      }
    }

    const outboundMessage = await prisma.outboundMessage.create({
      data: {
        channel: body.channel,
        to: targetTo,
        templateKey: template.key,
        renderedText,
        status: "QUEUED",
        priority: "MEDIUM",
        leadId: lead?.id ?? null,
        studentId: student?.id ?? null,
        notificationId: typeof body.notificationId === "string" ? body.notificationId : null,
        nextAttemptAt: nowUtc(),
      },
    });

    if (typeof body.notificationId === "string") {
      await prisma.notification.update({
        where: { id: body.notificationId },
        data: { status: "DOING" },
      }).catch(() => undefined);
    }

    return NextResponse.json({ outboundMessage, skipped: false });
  } catch {
    return jsonError(500, "INTERNAL_ERROR", "Internal server error");
  }
}
