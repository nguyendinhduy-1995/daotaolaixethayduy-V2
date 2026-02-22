import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireMappedRoutePermissionAuth } from "@/lib/route-auth";
import { requireAdminRole } from "@/lib/admin-auth";

/**
 * Cohort Analysis — group users by first-visit week, track return rates
 * GET /api/analytics/cohort?weeks=8&site=mophong
 */
export async function GET(req: Request) {
    const authResult = await requireMappedRoutePermissionAuth(req);
    if (authResult.error) return authResult.error;
    const adminError = requireAdminRole(authResult.auth.role);
    if (adminError) return adminError;

    const url = new URL(req.url);
    const weeks = Math.min(parseInt(url.searchParams.get("weeks") || "8"), 12);
    const site = url.searchParams.get("site") || undefined;

    const now = new Date();
    const startDate = new Date(now); startDate.setDate(startDate.getDate() - weeks * 7);

    try {
        const baseWhere = site
            ? { createdAt: { gte: startDate }, site, eventType: "page_view" as const }
            : { createdAt: { gte: startDate }, eventType: "page_view" as const };

        const events = await prisma.siteAnalyticsEvent.findMany({
            where: baseWhere,
            select: { ip: true, sessionId: true, createdAt: true },
            orderBy: { createdAt: "asc" },
        });

        // Build user first-seen map (using IP as user identity)
        const userFirstSeen = new Map<string, Date>();
        events.forEach(e => {
            const uid = e.ip || e.sessionId;
            if (!userFirstSeen.has(uid)) userFirstSeen.set(uid, e.createdAt);
        });

        // Build user activity by week
        const userWeeks = new Map<string, Set<number>>();
        events.forEach(e => {
            const uid = e.ip || e.sessionId;
            const weekNum = Math.floor((e.createdAt.getTime() - startDate.getTime()) / (7 * 24 * 3600 * 1000));
            if (!userWeeks.has(uid)) userWeeks.set(uid, new Set());
            userWeeks.get(uid)!.add(weekNum);
        });

        // Build cohort matrix
        // cohortWeek = week user was first seen
        // retentionWeek = how many weeks later they returned
        const cohortData: Array<{
            cohortWeek: string;
            totalUsers: number;
            retention: number[]; // retention[0] = week0 (100%), retention[1] = week1 return rate, etc.
        }> = [];

        for (let cw = 0; cw < weeks; cw++) {
            const cohortStart = new Date(startDate.getTime() + cw * 7 * 24 * 3600 * 1000);
            const cohortEnd = new Date(cohortStart.getTime() + 7 * 24 * 3600 * 1000);
            const cohortLabel = cohortStart.toISOString().slice(0, 10);

            // Users whose first visit was in this cohort week
            const cohortUsers: string[] = [];
            userFirstSeen.forEach((firstDate, uid) => {
                if (firstDate >= cohortStart && firstDate < cohortEnd) cohortUsers.push(uid);
            });

            if (cohortUsers.length === 0) {
                cohortData.push({ cohortWeek: cohortLabel, totalUsers: 0, retention: [] });
                continue;
            }

            const retention: number[] = [];
            const maxRetWeeks = weeks - cw;
            for (let rw = 0; rw < maxRetWeeks; rw++) {
                const targetWeek = cw + rw;
                const returning = cohortUsers.filter(uid => userWeeks.get(uid)!.has(targetWeek)).length;
                retention.push(Math.round((returning / cohortUsers.length) * 100));
            }

            cohortData.push({ cohortWeek: cohortLabel, totalUsers: cohortUsers.length, retention });
        }

        return NextResponse.json({ cohortData, weeks, site: site || "all" });
    } catch (err) {
        console.error("[cohort.GET]", err);
        return NextResponse.json({ error: "Internal error" }, { status: 500 });
    }
}
