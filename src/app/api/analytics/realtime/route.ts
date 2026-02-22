import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireMappedRoutePermissionAuth } from "@/lib/route-auth";
import { requireAdminRole } from "@/lib/admin-auth";

/**
 * Real-time Analytics — live visitors and recent event stream
 * GET /api/analytics/realtime?site=mophong
 */
export async function GET(req: Request) {
    const authResult = await requireMappedRoutePermissionAuth(req);
    if (authResult.error) return authResult.error;
    const adminError = requireAdminRole(authResult.auth.role);
    if (adminError) return adminError;

    const url = new URL(req.url);
    const site = url.searchParams.get("site") || undefined;

    const now = new Date();
    const fiveMinAgo = new Date(now.getTime() - 5 * 60 * 1000);
    const oneMinAgo = new Date(now.getTime() - 60 * 1000);
    const thirtyMinAgo = new Date(now.getTime() - 30 * 60 * 1000);

    try {
        const baseWhere = site
            ? { site }
            : {};

        // Active users in last 5 minutes
        const recentEvents = await prisma.siteAnalyticsEvent.findMany({
            where: { ...baseWhere, createdAt: { gte: fiveMinAgo } },
            select: { eventType: true, page: true, site: true, sessionId: true, createdAt: true, ip: true },
            orderBy: { createdAt: "desc" },
        });

        const activeUsers = new Set(recentEvents.map(e => e.ip || e.sessionId)).size;
        const activeSessions = new Set(recentEvents.map(e => e.sessionId)).size;
        const activeInLastMin = new Set(
            recentEvents.filter(e => e.createdAt >= oneMinAgo).map(e => e.ip || e.sessionId)
        ).size;

        // Recent event stream (last 20 events)
        const eventStream = recentEvents.slice(0, 20).map(e => ({
            type: e.eventType,
            page: e.page,
            site: e.site,
            ago: Math.round((now.getTime() - e.createdAt.getTime()) / 1000), // seconds ago
        }));

        // Pages being viewed right now (in last 5 min)
        const activePages = new Map<string, number>();
        recentEvents.filter(e => e.eventType === "page_view").forEach(e => {
            activePages.set(e.page, (activePages.get(e.page) || 0) + 1);
        });
        const topActivePages = Array.from(activePages.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([page, views]) => ({ page, views }));

        // Sites active
        const siteCounts: Record<string, number> = {};
        recentEvents.forEach(e => { siteCounts[e.site] = (siteCounts[e.site] || 0) + 1; });

        // 30-minute sparkline (events per minute)
        const thirtyMinEvents = await prisma.siteAnalyticsEvent.count({
            where: { ...baseWhere, createdAt: { gte: thirtyMinAgo }, eventType: "page_view" },
        });

        // Per-minute counts for sparkline
        const minuteMap: number[] = new Array(30).fill(0);
        const thirtyMinEventsDetail = await prisma.siteAnalyticsEvent.findMany({
            where: { ...baseWhere, createdAt: { gte: thirtyMinAgo }, eventType: "page_view" },
            select: { createdAt: true },
        });
        thirtyMinEventsDetail.forEach(e => {
            const minAgo = Math.floor((now.getTime() - e.createdAt.getTime()) / 60000);
            if (minAgo >= 0 && minAgo < 30) minuteMap[29 - minAgo]++;
        });

        return NextResponse.json({
            activeUsers,
            activeSessions,
            activeInLastMin,
            eventStream,
            topActivePages,
            siteCounts,
            sparkline: minuteMap,
            totalLast30Min: thirtyMinEvents,
            timestamp: now.toISOString(),
        });
    } catch (err) {
        console.error("[realtime.GET]", err);
        return NextResponse.json({ error: "Internal error" }, { status: 500 });
    }
}
