import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError } from "@/lib/api-response";
import { requireRouteAuth } from "@/lib/route-auth";
import { requireAdminRole } from "@/lib/admin-auth";

/**
 * GET /api/admin/audit-logs — View audit trail (admin only)
 * 
 * Query params:
 *   entity  — filter by entity type (lead, receipt, student, etc.)
 *   userId  — filter by user who performed action
 *   action  — filter by action type (CREATE, UPDATE, DELETE, LOGIN)
 *   from    — date range start (YYYY-MM-DD)
 *   to      — date range end
 *   page    — pagination (default 1)
 *   pageSize — items per page (default 50, max 100)
 */
export async function GET(req: Request) {
    const { error, auth } = requireRouteAuth(req);
    if (error) return error;
    const forbidden = requireAdminRole(auth.role);
    if (forbidden) return forbidden;

    try {
        const url = new URL(req.url);
        const entity = url.searchParams.get("entity")?.trim() || undefined;
        const userId = url.searchParams.get("userId")?.trim() || undefined;
        const action = url.searchParams.get("action")?.toUpperCase().trim() || undefined;
        const entityId = url.searchParams.get("entityId")?.trim() || undefined;
        const from = url.searchParams.get("from")?.trim() || undefined;
        const to = url.searchParams.get("to")?.trim() || undefined;
        const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
        const pageSize = Math.min(100, Math.max(1, Number(url.searchParams.get("pageSize")) || 50));

        const where: Record<string, unknown> = {};
        if (entity) where.entity = entity;
        if (userId) where.userId = userId;
        if (action) where.action = action;
        if (entityId) where.entityId = entityId;
        if (from || to) {
            const createdAt: Record<string, Date> = {};
            if (from) createdAt.gte = new Date(from);
            if (to) createdAt.lte = new Date(to + "T23:59:59.999Z");
            where.createdAt = createdAt;
        }

        const [items, total] = await Promise.all([
            prisma.auditLog.findMany({
                where,
                orderBy: { createdAt: "desc" },
                skip: (page - 1) * pageSize,
                take: pageSize,
            }),
            prisma.auditLog.count({ where }),
        ]);

        return NextResponse.json({
            items: items.map(log => ({
                id: log.id,
                action: log.action,
                entity: log.entity,
                entityId: log.entityId,
                userId: log.userId,
                userEmail: log.userEmail,
                summary: log.summary,
                before: log.before,
                after: log.after,
                ip: log.ip,
                createdAt: log.createdAt,
            })),
            page,
            pageSize,
            total,
            totalPages: Math.ceil(total / pageSize),
        });
    } catch (err) {
        console.error("[audit-logs.GET]", err);
        return jsonError(500, "INTERNAL_ERROR", "Lỗi khi tải nhật ký hoạt động");
    }
}
