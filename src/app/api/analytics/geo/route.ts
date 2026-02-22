import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireMappedRoutePermissionAuth } from "@/lib/route-auth";
import { requireAdminRole } from "@/lib/admin-auth";

/**
 * Geographic Analytics — aggregate by province/region for VN, country for others
 * GET /api/analytics/geo?range=7&site=mophong
 */
export async function GET(req: Request) {
    const authResult = await requireMappedRoutePermissionAuth(req);
    if (authResult.error) return authResult.error;
    const adminError = requireAdminRole(authResult.auth.role);
    if (adminError) return adminError;

    const url = new URL(req.url);
    const range = parseInt(url.searchParams.get("range") || "7");
    const site = url.searchParams.get("site") || undefined;

    const now = new Date();
    const start = new Date(now); start.setDate(start.getDate() - range);

    try {
        const baseWhere = site
            ? { createdAt: { gte: start }, site }
            : { createdAt: { gte: start } };

        const events = await prisma.siteAnalyticsEvent.findMany({
            where: baseWhere,
            select: { country: true, region: true, ip: true, sessionId: true, eventType: true },
        });

        // ── Province breakdown (for VN) ──
        const provinceMap = new Map<string, { sessions: Set<string>; pageViews: number; users: Set<string> }>();
        // ── Country breakdown (for non-VN or overview) ──
        const countryMap = new Map<string, { sessions: Set<string>; pageViews: number; users: Set<string> }>();

        events.forEach(e => {
            const country = e.country || "Không rõ";

            // Country aggregation
            if (!countryMap.has(country)) countryMap.set(country, { sessions: new Set(), pageViews: 0, users: new Set() });
            const cm = countryMap.get(country)!;
            cm.sessions.add(e.sessionId);
            if (e.ip) cm.users.add(e.ip);
            if (e.eventType === "page_view") cm.pageViews++;

            // Province aggregation (VN only)
            if (country === "VN" || country === "Việt Nam") {
                const province = e.region || "Không rõ tỉnh";
                if (!provinceMap.has(province)) provinceMap.set(province, { sessions: new Set(), pageViews: 0, users: new Set() });
                const pm = provinceMap.get(province)!;
                pm.sessions.add(e.sessionId);
                if (e.ip) pm.users.add(e.ip);
                if (e.eventType === "page_view") pm.pageViews++;
            }
        });

        // Format countries
        const countries = Array.from(countryMap.entries())
            .map(([name, data]) => ({
                country: name === "VN" ? "Việt Nam" : name === "US" ? "Hoa Kỳ" : name === "Unknown" ? "Không rõ" : name,
                sessions: data.sessions.size,
                pageViews: data.pageViews,
                users: data.users.size,
            }))
            .sort((a, b) => b.sessions - a.sessions);

        const totalSessions = countries.reduce((s, c) => s + c.sessions, 0);
        const countriesWithPct = countries.map(c => ({
            ...c,
            pct: totalSessions > 0 ? Math.round((c.sessions / totalSessions) * 100) : 0,
        }));

        // Format provinces
        const provinces = Array.from(provinceMap.entries())
            .map(([name, data]) => ({
                province: name,
                sessions: data.sessions.size,
                pageViews: data.pageViews,
                users: data.users.size,
            }))
            .sort((a, b) => b.sessions - a.sessions);

        const totalProvinceSessions = provinces.reduce((s, p) => s + p.sessions, 0);
        const provincesWithPct = provinces.map(p => ({
            ...p,
            pct: totalProvinceSessions > 0 ? Math.round((p.sessions / totalProvinceSessions) * 100) : 0,
        }));

        return NextResponse.json({
            countries: countriesWithPct.slice(0, 20),
            provinces: provincesWithPct.slice(0, 63), // VN has 63 provinces
            totalCountries: countries.length,
            totalProvinces: provinces.length,
            totalSessions,
            range,
            site: site || "all",
        });
    } catch (err) {
        console.error("[geo.GET]", err);
        return NextResponse.json({ error: "Internal error" }, { status: 500 });
    }
}
