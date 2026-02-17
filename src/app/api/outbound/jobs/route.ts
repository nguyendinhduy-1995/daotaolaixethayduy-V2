import { NextResponse } from "next/server";
import { type NotificationPriority, type NotificationScope, type OutboundJobStatus, type Prisma } from "@prisma/client";
import { jsonError } from "@/lib/api-response";
import { API_ERROR_VI } from "@/lib/api-error-vi";
import { requireIdempotencyKey, withIdempotency } from "@/lib/idempotency";
import { requireMappedRoutePermissionAuth } from "@/lib/route-auth";
import { prisma } from "@/lib/prisma";
import {
  AiCoachForbiddenError,
  AiCoachValidationError,
  createOutboundJobFromAction,
} from "@/lib/services/ai-kpi-coach";
import { resolveScope } from "@/lib/scope";

const JOB_STATUSES: OutboundJobStatus[] = ["NEW", "DISPATCHED", "DONE", "FAILED"];
const TASK_SCOPES: NotificationScope[] = ["FINANCE", "FOLLOWUP", "SCHEDULE", "SYSTEM"];
const TASK_PRIORITIES: NotificationPriority[] = ["HIGH", "MEDIUM", "LOW"];

function parseStatus(value: string | null): OutboundJobStatus | null {
  if (!value) return null;
  const normalized = value.trim().toUpperCase();
  return JOB_STATUSES.includes(normalized as OutboundJobStatus) ? (normalized as OutboundJobStatus) : null;
}

function parsePositiveInt(value: string | null, fallback: number, max = 100) {
  if (value === null) return fallback;
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) throw new Error("INVALID_PAGINATION");
  return Math.min(n, max);
}

export async function GET(req: Request) {
  const authResult = await requireMappedRoutePermissionAuth(req);
  if (authResult.error) return authResult.error;

  try {
    const { searchParams } = new URL(req.url);
    const status = parseStatus(searchParams.get("status"));
    if (searchParams.get("status") && !status) {
      return jsonError(400, "VALIDATION_ERROR", "Trạng thái danh sách gọi không hợp lệ");
    }

    const page = parsePositiveInt(searchParams.get("page"), 1);
    const pageSize = parsePositiveInt(searchParams.get("pageSize"), 20);
    const scope = await resolveScope(authResult.auth);

    const andWhere: Prisma.OutboundJobWhereInput[] = [];
    if (scope.mode === "BRANCH" && scope.branchId) {
      andWhere.push({ branchId: scope.branchId });
    }
    if (scope.mode === "OWNER" && scope.ownerId) {
      andWhere.push({ ownerId: scope.ownerId });
      if (scope.branchId) andWhere.push({ branchId: scope.branchId });
    }

    const where: Prisma.OutboundJobWhereInput = {
      ...(status ? { status } : {}),
      ...(andWhere.length > 0 ? { AND: andWhere } : {}),
    };

    const [items, total] = await Promise.all([
      prisma.outboundJob.findMany({
        where,
        include: {
          branch: { select: { id: true, name: true } },
          owner: { select: { id: true, name: true, email: true } },
          createdBy: { select: { id: true, name: true, email: true } },
          suggestion: { select: { id: true, title: true } },
          task: { select: { id: true, title: true, status: true } },
        },
        orderBy: [{ createdAt: "desc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.outboundJob.count({ where }),
    ]);

    return NextResponse.json({ items, page, pageSize, total });
  } catch (error) {
    if (error instanceof Error && error.message === "INVALID_PAGINATION") {
      return jsonError(400, "VALIDATION_ERROR", API_ERROR_VI.required);
    }
    return jsonError(500, "INTERNAL_ERROR", API_ERROR_VI.internal);
  }
}

export async function POST(req: Request) {
  const authResult = await requireMappedRoutePermissionAuth(req);
  if (authResult.error) return authResult.error;

  try {
    const idempotency = requireIdempotencyKey(req);
    if (idempotency.error) return idempotency.error;

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return jsonError(400, "VALIDATION_ERROR", API_ERROR_VI.required);
    }

    const route = new URL(req.url).pathname;
    return (
      await withIdempotency({
        key: idempotency.key!,
        route,
        actorType: "user",
        actorId: authResult.auth.sub,
        requestBody: body,
        execute: async () => {
          const bodyInput = body as Record<string, unknown>;
          const data = await createOutboundJobFromAction({
            auth: authResult.auth,
            body: body as {
              channel: unknown;
              templateKey: unknown;
              leadId?: unknown;
              studentId?: unknown;
              to?: unknown;
              priority?: unknown;
              variables?: unknown;
              note?: unknown;
            },
          });

          const suggestionId = typeof bodyInput.suggestionId === "string" ? bodyInput.suggestionId : null;
          const actionKey = typeof bodyInput.actionKey === "string" ? bodyInput.actionKey : "CREATE_OUTBOUND_JOB";
          const title = typeof bodyInput.title === "string" && bodyInput.title.trim() ? bodyInput.title.trim() : "Danh sách gọi nhắc";
          const existingTaskId = typeof bodyInput.taskId === "string" ? bodyInput.taskId : null;
          const taskScopeRaw = typeof bodyInput.scope === "string" ? bodyInput.scope.toUpperCase() : "FOLLOWUP";
          const taskPriorityRaw = typeof bodyInput.priority === "string" ? bodyInput.priority.toUpperCase() : "MEDIUM";
          const taskScope: NotificationScope = TASK_SCOPES.includes(taskScopeRaw as NotificationScope)
            ? (taskScopeRaw as NotificationScope)
            : "FOLLOWUP";
          const taskPriority: NotificationPriority = TASK_PRIORITIES.includes(taskPriorityRaw as NotificationPriority)
            ? (taskPriorityRaw as NotificationPriority)
            : "MEDIUM";

          const ownerIdFromLead = data.outboundMessage.leadId
            ? (
                await prisma.lead.findUnique({
                  where: { id: data.outboundMessage.leadId },
                  select: { ownerId: true },
                })
              )?.ownerId || null
            : null;
          const ownerId = ownerIdFromLead || authResult.auth.sub;

          const linkedTask = existingTaskId
            ? await prisma.notification.findUnique({
                where: { id: existingTaskId },
                select: { id: true },
              })
            : await prisma.notification.create({
                data: {
                  scope: taskScope,
                  status: "NEW",
                  priority: taskPriority,
                  title,
                  message: `Theo dõi tiến độ danh sách gọi từ gợi ý ${suggestionId || "thủ công"}`,
                  payload: {
                    kind: "TASK",
                    taskType: "CALL_LIST",
                    suggestionId,
                    actionKey,
                    source: "outbound-job",
                    outboundMessageId: data.outboundMessage.id,
                  },
                  ownerId,
                  leadId: data.outboundMessage.leadId,
                  studentId: data.outboundMessage.studentId,
                },
                select: { id: true },
              });

          const outboundJob = await prisma.outboundJob.create({
            data: {
              title,
              status: "NEW",
              idempotencyKey: idempotency.key,
              suggestionId,
              taskId: linkedTask?.id || null,
              branchId: data.outboundMessage.branchId,
              ownerId,
              createdById: authResult.auth.sub,
              metaJson: {
                branchId: data.outboundMessage.branchId,
                ownerId,
                suggestionId,
                actionKey,
                taskId: linkedTask?.id || null,
                toPhone: data.outboundMessage.to || null,
                messageText: data.outboundMessage.renderedText || null,
              },
              payloadJson: {
                source: "ui",
                actionKey,
                outboundMessageId: data.outboundMessage.id,
                channel: data.outboundMessage.channel,
                templateKey: data.outboundMessage.templateKey,
              },
            },
          });

          await prisma.automationLog.create({
            data: {
              branchId: data.outboundMessage.branchId,
              leadId: data.outboundMessage.leadId,
              studentId: data.outboundMessage.studentId,
              channel: "ui",
              milestone: "ai-apply",
              status: "sent",
              payload: {
                source: "ui",
                suggestionId,
                actionKey,
                createdById: authResult.auth.sub,
                outboundMessageId: data.outboundMessage.id,
                outboundJobId: outboundJob.id,
                taskId: linkedTask?.id || null,
              },
            },
          });

          return { statusCode: 200, responseJson: { ...data, outboundJob } as Record<string, unknown> };
        },
      })
    ).response;
  } catch (error) {
    if (error instanceof AiCoachValidationError) return jsonError(400, "VALIDATION_ERROR", error.message);
    if (error instanceof AiCoachForbiddenError) return jsonError(403, "AUTH_FORBIDDEN", error.message);
    return jsonError(500, "INTERNAL_ERROR", API_ERROR_VI.internal);
  }
}
