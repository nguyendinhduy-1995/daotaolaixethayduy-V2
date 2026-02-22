import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

/**
 * Audit Trail — log important CRM actions for traceability
 * 
 * Usage:
 *   await logAudit({
 *     action: "CREATE",
 *     entity: "lead",
 *     entityId: lead.id,
 *     userId: auth.sub,
 *     userEmail: auth.email,
 *     summary: `Tạo lead mới: ${lead.fullName}`,
 *     after: lead,
 *     ip: req.headers.get("x-forwarded-for"),
 *   });
 */

export type AuditAction = "CREATE" | "UPDATE" | "DELETE" | "LOGIN" | "EXPORT" | "ASSIGN" | "IMPORT";
export type AuditEntity = "lead" | "receipt" | "student" | "schedule" | "instructor" | "user" | "expense" | "course" | "system";

interface AuditLogInput {
    action: AuditAction;
    entity: AuditEntity;
    entityId?: string | null;
    userId?: string | null;
    userEmail?: string | null;
    summary?: string | null;
    before?: Record<string, unknown> | null;
    after?: Record<string, unknown> | null;
    ip?: string | null;
}

/**
 * Log an audit event. Fire-and-forget — never throws.
 */
export async function logAudit(input: AuditLogInput): Promise<void> {
    try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const data: any = {
            action: input.action,
            entity: input.entity,
            entityId: input.entityId ?? null,
            userId: input.userId ?? null,
            userEmail: input.userEmail ?? null,
            summary: input.summary ?? null,
            ip: input.ip ?? null,
        };
        if (input.before) data.before = input.before;
        if (input.after) data.after = input.after;
        await prisma.auditLog.create({ data });
    } catch (err) {
        // Never fail the main request because of audit logging
        console.error("[audit] Failed to log:", err);
    }
}

/**
 * Helper to extract IP from request
 */
export function getRequestIp(req: Request): string | null {
    return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
        || req.headers.get("x-real-ip")
        || null;
}
