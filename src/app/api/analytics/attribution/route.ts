import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireMappedRoutePermissionAuth } from "@/lib/route-auth";
import { requireAdminRole } from "@/lib/admin-auth";

/**
 * Conversion Attribution — which UTM sources drive conversions
 * GET /api/analytics/attribution?range=30
 */
export async function GET(req: Request) {
    const authResult = await requireMappedRoutePermissionAuth(req);
    if (authResult.error) return authResult.error;
    const adminError = requireAdminRole(authResult.auth.role);
    if (adminError) return adminError;

    const url = new URL(req.url);
    const range = parseInt(url.searchParams.get("range") || "30");

    const now = new Date();
    const start = new Date(now); start.setDate(start.getDate() - range);

    try {
        const events = await prisma.siteAnalyticsEvent.findMany({
            where: { createdAt: { gte: start } },
            select: { eventType: true, sessionId: true, site: true, payload: true, page: true },
        });

        // Conversion events
        const conversionTypes = new Set(["form_submit", "phone_click", "zalo_click", "cta_click", "exam_start", "exam_finish"]);

        // Build session → UTM source mapping (first-touch attribution)
        type UtmPayload = { utm?: { utm_source?: string; utm_medium?: string; utm_campaign?: string } };
        const sessionUtm = new Map<string, { source: string; medium: string; campaign: string }>();

        events.filter(e => e.eventType === "page_view").forEach(e => {
            if (sessionUtm.has(e.sessionId)) return; // first touch only
            const utm = (e.payload as UtmPayload)?.utm;
            if (utm?.utm_source) {
                sessionUtm.set(e.sessionId, {
                    source: utm.utm_source,
                    medium: utm.utm_medium || "(none)",
                    campaign: utm.utm_campaign || "(none)",
                });
            }
        });

        // Count conversions by source
        const sourceConversions = new Map<string, {
            source: string; medium: string;
            sessions: number; conversions: number;
            types: Record<string, number>;
        }>();

        // Count total sessions per source
        const sourceSessionCounts = new Map<string, number>();
        sessionUtm.forEach((utm) => {
            const key = `${utm.source}/${utm.medium}`;
            sourceSessionCounts.set(key, (sourceSessionCounts.get(key) || 0) + 1);
        });

        // Count conversions
        events.filter(e => conversionTypes.has(e.eventType)).forEach(e => {
            const utm = sessionUtm.get(e.sessionId);
            if (!utm) return;
            const key = `${utm.source}/${utm.medium}`;
            if (!sourceConversions.has(key)) {
                sourceConversions.set(key, {
                    source: utm.source, medium: utm.medium,
                    sessions: sourceSessionCounts.get(key) || 0,
                    conversions: 0, types: {},
                });
            }
            const sc = sourceConversions.get(key)!;
            sc.conversions++;
            sc.types[e.eventType] = (sc.types[e.eventType] || 0) + 1;
        });

        // Also include sources with sessions but no conversions
        sessionUtm.forEach((utm) => {
            const key = `${utm.source}/${utm.medium}`;
            if (!sourceConversions.has(key)) {
                sourceConversions.set(key, {
                    source: utm.source, medium: utm.medium,
                    sessions: sourceSessionCounts.get(key) || 0,
                    conversions: 0, types: {},
                });
            }
        });

        const attribution = Array.from(sourceConversions.values())
            .map(sc => ({
                ...sc,
                conversionRate: sc.sessions > 0 ? Math.round((sc.conversions / sc.sessions) * 100) : 0,
            }))
            .sort((a, b) => b.conversions - a.conversions);

        // Overall stats
        const totalConversions = events.filter(e => conversionTypes.has(e.eventType)).length;
        const totalSessions = new Set(events.map(e => e.sessionId)).size;
        const attributedSessions = sessionUtm.size;

        // Site-level conversion
        const siteConversions: Record<string, { total: number; conversions: number; rate: number }> = {};
        const siteSessions = new Map<string, Set<string>>();
        events.forEach(e => {
            if (!siteSessions.has(e.site)) siteSessions.set(e.site, new Set());
            siteSessions.get(e.site)!.add(e.sessionId);
        });
        const siteConvEvents = new Map<string, number>();
        events.filter(e => conversionTypes.has(e.eventType)).forEach(e => {
            siteConvEvents.set(e.site, (siteConvEvents.get(e.site) || 0) + 1);
        });
        siteSessions.forEach((sessions, siteName) => {
            const conv = siteConvEvents.get(siteName) || 0;
            siteConversions[siteName] = {
                total: sessions.size,
                conversions: conv,
                rate: sessions.size > 0 ? Math.round((conv / sessions.size) * 100) : 0,
            };
        });

        return NextResponse.json({
            attribution: attribution.slice(0, 15),
            totalConversions,
            totalSessions,
            attributedSessions,
            overallRate: totalSessions > 0 ? Math.round((totalConversions / totalSessions) * 100) : 0,
            siteConversions,
            range,
        });
    } catch (err) {
        console.error("[attribution.GET]", err);
        return NextResponse.json({ error: "Internal error" }, { status: 500 });
    }
}
