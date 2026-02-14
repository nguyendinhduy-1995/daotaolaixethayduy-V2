import { NextResponse } from "next/server";
import type { AutomationLog } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { jsonError } from "@/lib/api-response";
import { requireRouteAuth } from "@/lib/route-auth";
import { requireAdminRole } from "@/lib/admin-auth";

type RunScope = "daily" | "manual";

function isScope(value: unknown): value is RunScope {
  return value === "daily" || value === "manual";
}

export async function POST(req: Request) {
  const authResult = requireRouteAuth(req);
  if (authResult.error) return authResult.error;
  const roleError = requireAdminRole(authResult.auth.role);
  if (roleError) return roleError;

  let log: AutomationLog | null = null;

  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object" || !isScope(body.scope)) {
      return jsonError(400, "VALIDATION_ERROR", "Invalid run input");
    }
    if (body.leadId !== undefined && typeof body.leadId !== "string") {
      return jsonError(400, "VALIDATION_ERROR", "leadId must be string");
    }
    if (body.studentId !== undefined && typeof body.studentId !== "string") {
      return jsonError(400, "VALIDATION_ERROR", "studentId must be string");
    }
    if (body.dryRun !== undefined && typeof body.dryRun !== "boolean") {
      return jsonError(400, "VALIDATION_ERROR", "dryRun must be boolean");
    }

    if (body.scope === "manual" && !body.leadId && !body.studentId) {
      return jsonError(400, "VALIDATION_ERROR", "manual scope requires leadId or studentId");
    }

    if (body.leadId) {
      const lead = await prisma.lead.findUnique({ where: { id: body.leadId }, select: { id: true } });
      if (!lead) return jsonError(404, "NOT_FOUND", "Lead not found");
    }
    if (body.studentId) {
      const student = await prisma.student.findUnique({ where: { id: body.studentId }, select: { id: true } });
      if (!student) return jsonError(404, "NOT_FOUND", "Student not found");
    }

    log = await prisma.automationLog.create({
      data: {
        leadId: body.leadId ?? null,
        studentId: body.studentId ?? null,
        channel: "system",
        templateKey: "automation.run",
        milestone: body.scope,
        status: "skipped",
        payload: {
          runtimeStatus: "queued",
          input: {
            scope: body.scope,
            leadId: body.leadId ?? null,
            studentId: body.studentId ?? null,
            dryRun: Boolean(body.dryRun),
            requestedBy: authResult.auth.sub,
          },
        },
      },
    });

    await prisma.automationLog.update({
      where: { id: log.id },
      data: {
        payload: {
          ...(log.payload && typeof log.payload === "object" ? log.payload : {}),
          runtimeStatus: "running",
        },
      },
    });

    const output = {
      executed: !Boolean(body.dryRun),
      scope: body.scope,
      leadId: body.leadId ?? null,
      studentId: body.studentId ?? null,
      message: body.dryRun ? "Dry run completed" : "Automation run completed",
    };

    const final = await prisma.automationLog.update({
      where: { id: log.id },
      data: {
        status: body.dryRun ? "skipped" : "sent",
        payload: {
          ...(log.payload && typeof log.payload === "object" ? log.payload : {}),
          runtimeStatus: "success",
          output,
        },
      },
    });

    return NextResponse.json({ log: final });
  } catch (error) {
    if (log) {
      await prisma.automationLog.update({
        where: { id: log.id },
        data: {
          status: "failed",
          payload: {
            ...(log.payload && typeof log.payload === "object" ? log.payload : {}),
            runtimeStatus: "failed",
            error: error instanceof Error ? error.message : "Unknown error",
          },
        },
      });
    }

    return jsonError(500, "INTERNAL_ERROR", "Internal server error");
  }
}
