import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireMappedRoutePermissionAuth } from "@/lib/route-auth";
import { requireAdminRole } from "@/lib/admin-auth";

export async function GET(req: Request) {
    const authResult = await requireMappedRoutePermissionAuth(req);
    if (authResult.error) return authResult.error;
    const adminError = requireAdminRole(authResult.auth.role);
    if (adminError) return adminError;

    const url = new URL(req.url);
    const siteFilter = url.searchParams.get("site");

    try {
        // Get unique IPs per day for the last 30 days
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        thirtyDaysAgo.setHours(0, 0, 0, 0);

        const where = siteFilter
            ? { createdAt: { gte: thirtyDaysAgo }, site: siteFilter }
            : { createdAt: { gte: thirtyDaysAgo } };

        const events = await prisma.siteAnalyticsEvent.findMany({
            where,
            select: { ip: true, createdAt: true },
        });

        // Group IPs by day
        const dayIPs: Record<string, Set<string>> = {};
        events.forEach(e => {
            if (!e.ip) return;
            const d = new Date(e.createdAt.getTime() + 7 * 3600 * 1000).toISOString().slice(0, 10);
            if (!dayIPs[d]) dayIPs[d] = new Set();
            dayIPs[d].add(e.ip);
        });

        const days = Object.keys(dayIPs).sort();

        // Calculate retention: for each day, how many IPs came back on day+1, day+3, day+7
        const retentionData: {
            date: string;
            totalUsers: number;
            d1: number; d3: number; d7: number;
            d1Rate: number; d3Rate: number; d7Rate: number;
        }[] = [];

        for (let i = 0; i < days.length; i++) {
            const day = days[i];
            const ips = dayIPs[day];
            if (!ips || ips.size === 0) continue;

            const d1Day = new Date(day);
            d1Day.setDate(d1Day.getDate() + 1);
            const d3Day = new Date(day);
            d3Day.setDate(d3Day.getDate() + 3);
            const d7Day = new Date(day);
            d7Day.setDate(d7Day.getDate() + 7);

            const d1Key = d1Day.toISOString().slice(0, 10);
            const d3Key = d3Day.toISOString().slice(0, 10);
            const d7Key = d7Day.toISOString().slice(0, 10);

            let d1Count = 0, d3Count = 0, d7Count = 0;
            ips.forEach(ip => {
                if (dayIPs[d1Key]?.has(ip)) d1Count++;
                if (dayIPs[d3Key]?.has(ip)) d3Count++;
                if (dayIPs[d7Key]?.has(ip)) d7Count++;
            });

            retentionData.push({
                date: day,
                totalUsers: ips.size,
                d1: d1Count,
                d3: d3Count,
                d7: d7Count,
                d1Rate: ips.size > 0 ? Math.round((d1Count / ips.size) * 100) : 0,
                d3Rate: ips.size > 0 ? Math.round((d3Count / ips.size) * 100) : 0,
                d7Rate: ips.size > 0 ? Math.round((d7Count / ips.size) * 100) : 0,
            });
        }

        // Average retention rates
        const avgD1 = retentionData.length > 0 ? Math.round(retentionData.reduce((s, r) => s + r.d1Rate, 0) / retentionData.length) : 0;
        const avgD3 = retentionData.length > 0 ? Math.round(retentionData.reduce((s, r) => s + r.d3Rate, 0) / retentionData.length) : 0;
        const avgD7 = retentionData.length > 0 ? Math.round(retentionData.reduce((s, r) => s + r.d7Rate, 0) / retentionData.length) : 0;

        return NextResponse.json({
            averageRetention: { d1: avgD1, d3: avgD3, d7: avgD7 },
            dailyRetention: retentionData.slice(-14), // last 14 days
        });
    } catch (err) {
        console.error("[analytics/retention.GET]", err);
        return NextResponse.json({ error: "Internal error" }, { status: 500 });
    }
}
