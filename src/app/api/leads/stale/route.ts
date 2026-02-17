import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { jsonError } from "@/lib/api-response";
import { API_ERROR_VI } from "@/lib/api-error-vi";
import { requirePermissionRouteAuth } from "@/lib/route-auth";
import { applyScopeToWhere, resolveScope } from "@/lib/scope";

/**
 * GET /api/leads/stale
 *
 * Returns leads that haven't been follow-up'd:
 *  - HAS_PHONE for > 3 days
 *  - APPOINTED for > 2 days past creation
 *
 * Query params: page, pageSize
 */
export async function GET(req: Request) {
    const authResult = await requirePermissionRouteAuth(req, { module: "leads", action: "VIEW" });
    if (authResult.error) return authResult.error;
    const auth = authResult.auth;

    try {
        const { searchParams } = new URL(req.url);
        const page = Math.max(1, Number(searchParams.get("page") || 1));
        const pageSize = Math.min(100, Math.max(1, Number(searchParams.get("pageSize") || 20)));

        const now = new Date();
        const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
        const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);

        const scope = await resolveScope(auth);

        const whereBase: Prisma.LeadWhereInput = {
            OR: [
                { status: "HAS_PHONE", updatedAt: { lt: threeDaysAgo } },
                { status: "APPOINTED", updatedAt: { lt: twoDaysAgo } },
            ],
        };
        const where = applyScopeToWhere(whereBase, scope, "lead");

        const [items, total] = await Promise.all([
            prisma.lead.findMany({
                where,
                orderBy: { updatedAt: "asc" },
                skip: (page - 1) * pageSize,
                take: pageSize,
                include: {
                    owner: { select: { id: true, name: true, email: true } },
                },
            }),
            prisma.lead.count({ where }),
        ]);

        const staleItems = items.map((item) => {
            const daysSinceUpdate = Math.floor(
                (now.getTime() - item.updatedAt.getTime()) / (24 * 60 * 60 * 1000)
            );
            return {
                ...item,
                daysSinceUpdate,
                warningLevel: daysSinceUpdate >= 5 ? "HIGH" as const : daysSinceUpdate >= 3 ? "MEDIUM" as const : "LOW" as const,
            };
        });

        return NextResponse.json({ items: staleItems, page, pageSize, total });
    } catch (err) {
    console.error("[leads.stale]", err);
        return jsonError(500, "INTERNAL_ERROR", API_ERROR_VI.internal);
    }
}
