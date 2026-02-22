import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireMappedRoutePermissionAuth } from "@/lib/route-auth";
import { requireAdminRole } from "@/lib/admin-auth";

/**
 * Goal Tracking — CRUD for analytics goals + progress calculation
 * GET /api/analytics/goals — list goals with current progress
 * POST /api/analytics/goals — create/update a goal
 * DELETE /api/analytics/goals?id=xxx — delete a goal
 */

const METRIC_EVENTS: Record<string, string[]> = {
    page_views: ["page_view"],
    sessions: ["page_view"], // count distinct sessions
    conversions: ["form_submit", "phone_click", "zalo_click"],
    exam_starts: ["exam_start"],
    exam_finishes: ["exam_finish"],
    form_submits: ["form_submit"],
};

function getPeriodRange(period: string): { start: Date; end: Date } {
    const now = new Date();
    const end = now;
    const start = new Date(now);
    if (period === "daily") { start.setHours(0, 0, 0, 0); }
    else if (period === "weekly") { start.setDate(start.getDate() - start.getDay()); start.setHours(0, 0, 0, 0); }
    else if (period === "monthly") { start.setDate(1); start.setHours(0, 0, 0, 0); }
    return { start, end };
}

export async function GET(req: Request) {
    const authResult = await requireMappedRoutePermissionAuth(req);
    if (authResult.error) return authResult.error;
    const adminError = requireAdminRole(authResult.auth.role);
    if (adminError) return adminError;

    try {
        const goals = await prisma.analyticsGoal.findMany({
            where: { active: true },
            orderBy: { createdAt: "desc" },
        });

        // Calculate current progress for each goal
        const goalsWithProgress = await Promise.all(goals.map(async (goal) => {
            const { start, end } = getPeriodRange(goal.period);
            const eventTypes = METRIC_EVENTS[goal.metric] || [goal.metric];
            const baseWhere = {
                createdAt: { gte: start, lte: end },
                eventType: { in: eventTypes },
                ...(goal.site ? { site: goal.site } : {}),
            };

            let current = 0;
            if (goal.metric === "sessions") {
                const sessions = await prisma.siteAnalyticsEvent.findMany({
                    where: baseWhere,
                    select: { sessionId: true },
                    distinct: ["sessionId"],
                });
                current = sessions.length;
            } else {
                current = await prisma.siteAnalyticsEvent.count({ where: baseWhere });
            }

            const pct = goal.target > 0 ? Math.round((current / goal.target) * 100) : 0;
            return { ...goal, current, pct, periodLabel: `${start.toISOString().slice(0, 10)} → ${end.toISOString().slice(0, 10)}` };
        }));

        return NextResponse.json({ goals: goalsWithProgress });
    } catch (err) {
        console.error("[goals.GET]", err);
        return NextResponse.json({ error: "Internal error" }, { status: 500 });
    }
}

export async function POST(req: Request) {
    const authResult = await requireMappedRoutePermissionAuth(req);
    if (authResult.error) return authResult.error;
    const adminError = requireAdminRole(authResult.auth.role);
    if (adminError) return adminError;

    try {
        const body = await req.json();
        const { id, name, metric, target, period, site } = body;

        if (!name || !metric || !target || !period) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        if (id) {
            // Update existing goal
            const updated = await prisma.analyticsGoal.update({
                where: { id },
                data: { name, metric, target: Number(target), period, site: site || null },
            });
            return NextResponse.json({ goal: updated });
        } else {
            // Create new goal
            const created = await prisma.analyticsGoal.create({
                data: { name, metric, target: Number(target), period, site: site || null },
            });
            return NextResponse.json({ goal: created });
        }
    } catch (err) {
        console.error("[goals.POST]", err);
        return NextResponse.json({ error: "Internal error" }, { status: 500 });
    }
}

export async function DELETE(req: Request) {
    const authResult = await requireMappedRoutePermissionAuth(req);
    if (authResult.error) return authResult.error;
    const adminError = requireAdminRole(authResult.auth.role);
    if (adminError) return adminError;

    try {
        const url = new URL(req.url);
        const id = url.searchParams.get("id");
        if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

        await prisma.analyticsGoal.update({ where: { id }, data: { active: false } });
        return NextResponse.json({ ok: true });
    } catch (err) {
        console.error("[goals.DELETE]", err);
        return NextResponse.json({ error: "Internal error" }, { status: 500 });
    }
}
