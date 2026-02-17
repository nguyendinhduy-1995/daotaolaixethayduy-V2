import { NextResponse } from "next/server";
import type { AutomationLog } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { jsonError } from "@/lib/api-response";
import { requirePermissionRouteAuth } from "@/lib/route-auth";
import { API_ERROR_VI } from "@/lib/api-error-vi";
import { resolveWriteBranchId } from "@/lib/scope";

type RunScope = "daily" | "manual";

function isScope(value: unknown): value is RunScope {
  return value === "daily" || value === "manual";
}

export async function POST(req: Request) {
  const authResult = await requirePermissionRouteAuth(req, { module: "automation_run", action: "RUN" });
  if (authResult.error) return authResult.error;

  let log: AutomationLog | null = null;

  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object" || !isScope(body.scope)) {
      return jsonError(400, "VALIDATION_ERROR", API_ERROR_VI.required);
    }
    if (body.leadId !== undefined && typeof body.leadId !== "string") {
      return jsonError(400, "VALIDATION_ERROR", API_ERROR_VI.required);
    }
    if (body.studentId !== undefined && typeof body.studentId !== "string") {
      return jsonError(400, "VALIDATION_ERROR", API_ERROR_VI.required);
    }
    if (body.dryRun !== undefined && typeof body.dryRun !== "boolean") {
      return jsonError(400, "VALIDATION_ERROR", API_ERROR_VI.required);
    }

    if (body.scope === "manual" && !body.leadId && !body.studentId) {
      return jsonError(400, "VALIDATION_ERROR", API_ERROR_VI.required);
    }

    let leadBranchId: string | null = null;
    let studentBranchId: string | null = null;

    if (body.leadId) {
      const lead = await prisma.lead.findUnique({
        where: { id: body.leadId },
        select: { id: true, branchId: true },
      });
      if (!lead) return jsonError(404, "NOT_FOUND", API_ERROR_VI.notFoundLead);
      leadBranchId = lead.branchId;
    }
    if (body.studentId) {
      const student = await prisma.student.findUnique({
        where: { id: body.studentId },
        select: { id: true, branchId: true },
      });
      if (!student) return jsonError(404, "NOT_FOUND", API_ERROR_VI.notFoundStudent);
      studentBranchId = student.branchId;
    }

    const branchId = await resolveWriteBranchId(authResult.auth, [leadBranchId, studentBranchId]);

    log = await prisma.automationLog.create({
      data: {
        branchId,
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
      message: body.dryRun ? "Chạy thử thành công" : "Chạy tự động hóa thành công",
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
            error: error instanceof Error ? error.message : API_ERROR_VI.internal,
          },
        },
      });
    }

    return jsonError(500, "INTERNAL_ERROR", API_ERROR_VI.internal);
  }
}
