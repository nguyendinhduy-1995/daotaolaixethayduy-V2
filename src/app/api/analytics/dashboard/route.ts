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
    const date = url.searchParams.get("date") || new Date().toISOString().slice(0, 10);
    const siteFilter = url.searchParams.get("site"); // mophong | taplai | landing | null

    const dayStart = new Date(`${date}T00:00:00+07:00`);
    const dayEnd = new Date(`${date}T23:59:59.999+07:00`);

    // Also get yesterday for comparison
    const yesterday = new Date(dayStart);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayEnd = new Date(yesterday);
    yesterdayEnd.setHours(23, 59, 59, 999);

    // Build base where clause with optional site filter
    const baseWhere = siteFilter
        ? { createdAt: { gte: dayStart, lte: dayEnd }, site: siteFilter }
        : { createdAt: { gte: dayStart, lte: dayEnd } };
    const yesterdayWhere = siteFilter
        ? { createdAt: { gte: yesterday, lte: yesterdayEnd }, site: siteFilter }
        : { createdAt: { gte: yesterday, lte: yesterdayEnd } };

    try {
        // ── All events for today ──────────────────────────────
        const allEvents = await prisma.siteAnalyticsEvent.findMany({
            where: baseWhere,
            select: { eventType: true, page: true, site: true, sessionId: true, userAgent: true, createdAt: true, duration: true, referrer: true, screenWidth: true, ip: true, payload: true },
        });

        // ── Yesterday events for comparison ───────────────────
        const yesterdayPageViews = await prisma.siteAnalyticsEvent.count({
            where: { ...yesterdayWhere, eventType: "page_view" },
        });
        const yesterdaySessions = await prisma.siteAnalyticsEvent.findMany({
            where: yesterdayWhere,
            select: { sessionId: true },
            distinct: ["sessionId"],
        });

        // ── 1. Basic counts ──────────────────────────────────
        const pageViews = allEvents.filter(e => e.eventType === "page_view");
        const totalPageViews = pageViews.length;

        // Unique sessions
        const sessionIds = new Set(allEvents.map(e => e.sessionId));
        const uniqueSessions = sessionIds.size;

        // ── 2. Real users (by IP or unique sessions with different IPs) ──
        const uniqueIPs = new Set(allEvents.filter(e => e.ip).map(e => e.ip));
        const realUsers = uniqueIPs.size || uniqueSessions;

        // ── 3. New vs Returning users ─────────────────────────
        // Check which IPs/sessions appeared before today
        const returningIPs = new Set<string>();
        if (uniqueIPs.size > 0) {
            const prevWhere = siteFilter
                ? { createdAt: { lt: dayStart } as const, ip: { in: Array.from(uniqueIPs).filter(Boolean) as string[] }, site: siteFilter }
                : { createdAt: { lt: dayStart } as const, ip: { in: Array.from(uniqueIPs).filter(Boolean) as string[] } };
            const previousEvents = await prisma.siteAnalyticsEvent.findMany({
                where: prevWhere,
                select: { ip: true },
                distinct: ["ip"],
            });
            previousEvents.forEach(e => { if (e.ip) returningIPs.add(e.ip); });
        }
        const returningUsers = returningIPs.size;
        const newUsers = realUsers - returningUsers;

        // ── 4. Avg session duration ───────────────────────────
        const sessionEndEvents = allEvents.filter(e => e.eventType === "session_end" && e.duration);
        const avgDuration = sessionEndEvents.length > 0
            ? Math.round(sessionEndEvents.reduce((s, e) => s + (e.duration ?? 0), 0) / sessionEndEvents.length)
            : 0;

        // ── 5. Pages per session ─────────────────────────────
        const sessionPageCounts: Record<string, number> = {};
        pageViews.forEach(e => { sessionPageCounts[e.sessionId] = (sessionPageCounts[e.sessionId] || 0) + 1; });
        const sessionValues = Object.values(sessionPageCounts);
        const avgPagesPerSession = sessionValues.length > 0
            ? Math.round(sessionValues.reduce((s, v) => s + v, 0) / sessionValues.length * 10) / 10
            : 0;

        // ── 6. Bounce rate (sessions with only 1 page view) ──
        const bouncedSessions = sessionValues.filter(v => v === 1).length;
        const bounceRate = uniqueSessions > 0 ? Math.round((bouncedSessions / uniqueSessions) * 100) : 0;

        // ── 7. Top pages ─────────────────────────────────────
        const pageCounts: Record<string, number> = {};
        pageViews.forEach(e => { pageCounts[e.page] = (pageCounts[e.page] || 0) + 1; });
        const topPages = Object.entries(pageCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([page, count]) => ({ page, count, pct: totalPageViews > 0 ? Math.round((count / totalPageViews) * 100) : 0 }));

        // ── 8. Event breakdown ───────────────────────────────
        const eventBreakdown: Record<string, number> = {};
        allEvents.forEach(e => { eventBreakdown[e.eventType] = (eventBreakdown[e.eventType] || 0) + 1; });

        // ── 9. Device breakdown ──────────────────────────────
        const deviceSessions: Record<string, string> = {};
        allEvents.forEach(e => {
            if (!deviceSessions[e.sessionId] && e.userAgent) {
                const ua = e.userAgent.toLowerCase();
                deviceSessions[e.sessionId] = (ua.includes("mobi") || ua.includes("android") || ua.includes("iphone") || ua.includes("ipad")) ? "mobile" : "desktop";
            }
        });
        const mobile = Object.values(deviceSessions).filter(d => d === "mobile").length;
        const desktop = Object.values(deviceSessions).filter(d => d === "desktop").length;
        const mobilePercent = uniqueSessions > 0 ? Math.round((mobile / uniqueSessions) * 100) : 0;

        // ── 10. Hourly traffic ───────────────────────────────
        const hourly: number[] = new Array(24).fill(0);
        pageViews.forEach(e => {
            const hour = (e.createdAt.getUTCHours() + 7) % 24;
            hourly[hour]++;
        });
        const peakHour = hourly.indexOf(Math.max(...hourly));

        // ── 11. Site breakdown ───────────────────────────────
        const siteBreakdown: Record<string, number> = {};
        pageViews.forEach(e => { siteBreakdown[e.site] = (siteBreakdown[e.site] || 0) + 1; });

        // ── 12. Top referrers ────────────────────────────────
        const referrerCounts: Record<string, number> = {};
        pageViews.forEach(e => {
            if (!e.referrer) return;
            try {
                const hostname = new URL(e.referrer).hostname || e.referrer;
                referrerCounts[hostname] = (referrerCounts[hostname] || 0) + 1;
            } catch {
                referrerCounts[e.referrer] = (referrerCounts[e.referrer] || 0) + 1;
            }
        });
        const topReferrers = Object.entries(referrerCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([source, count]) => ({ source, count }));

        // ── 13. Screen size breakdown ────────────────────────
        const screenSizes: Record<string, number> = {};
        const seenScreenSession = new Set<string>();
        allEvents.forEach(e => {
            if (e.screenWidth && !seenScreenSession.has(e.sessionId)) {
                seenScreenSession.add(e.sessionId);
                const label = e.screenWidth <= 480 ? "📱 Điện thoại nhỏ" : e.screenWidth <= 768 ? "📱 Điện thoại" : e.screenWidth <= 1024 ? "📱 Tablet" : "💻 Desktop";
                screenSizes[label] = (screenSizes[label] || 0) + 1;
            }
        });

        // ── 14. Landing funnel (landing site only) ───────────
        const landingEvents = allEvents.filter(e => e.site === "landing");
        const landingFunnel = {
            visitors: new Set(landingEvents.filter(e => e.eventType === "page_view").map(e => e.sessionId)).size,
            pricingViewed: landingEvents.filter(e => e.eventType === "pricing_view").length,
            ctaClicks: landingEvents.filter(e => e.eventType === "cta_click").length,
            formViewed: landingEvents.filter(e => e.eventType === "form_view").length,
            formFocused: landingEvents.filter(e => e.eventType === "form_focus").length,
            formSubmitted: landingEvents.filter(e => e.eventType === "form_submit").length,
            phoneCalls: landingEvents.filter(e => e.eventType === "phone_click").length,
            zaloClicks: landingEvents.filter(e => e.eventType === "zalo_click").length,
        };
        const conversionRate = landingFunnel.visitors > 0
            ? Math.round(((landingFunnel.formSubmitted + landingFunnel.phoneCalls + landingFunnel.zaloClicks) / landingFunnel.visitors) * 100)
            : 0;

        // ── 15. User journey: top entry pages & exit pages ───
        const sessionFirstPage: Record<string, { page: string; time: Date }> = {};
        const sessionLastPage: Record<string, { page: string; time: Date }> = {};
        pageViews.forEach(e => {
            if (!sessionFirstPage[e.sessionId] || e.createdAt < sessionFirstPage[e.sessionId].time) {
                sessionFirstPage[e.sessionId] = { page: e.page, time: e.createdAt };
            }
            if (!sessionLastPage[e.sessionId] || e.createdAt > sessionLastPage[e.sessionId].time) {
                sessionLastPage[e.sessionId] = { page: e.page, time: e.createdAt };
            }
        });

        const entryPageCounts: Record<string, number> = {};
        Object.values(sessionFirstPage).forEach(v => { entryPageCounts[v.page] = (entryPageCounts[v.page] || 0) + 1; });
        const topEntryPages = Object.entries(entryPageCounts).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([page, count]) => ({ page, count }));

        const exitPageCounts: Record<string, number> = {};
        Object.values(sessionLastPage).forEach(v => { exitPageCounts[v.page] = (exitPageCounts[v.page] || 0) + 1; });
        const topExitPages = Object.entries(exitPageCounts).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([page, count]) => ({ page, count }));

        // ── 16. Engagement rate ──────────────────────────────
        // Sessions with any meaningful interaction (click, video, form, exam, scenario)
        const engagedSessionIds = new Set<string>();
        allEvents.forEach(e => {
            if (["click", "video_play", "form_submit", "form_focus", "cta_click", "phone_click", "zalo_click",
                "scenario_view", "scenario_brake", "exam_start", "question_answer", "topic_view", "daily_practice"].includes(e.eventType)) {
                engagedSessionIds.add(e.sessionId);
            }
        });
        const engagementRate = uniqueSessions > 0 ? Math.round((engagedSessionIds.size / uniqueSessions) * 100) : 0;

        // ── 17. Comparison with yesterday ────────────────────
        const viewsChange = yesterdayPageViews > 0
            ? Math.round(((totalPageViews - yesterdayPageViews) / yesterdayPageViews) * 100)
            : totalPageViews > 0 ? 100 : 0;
        const sessionsChange = yesterdaySessions.length > 0
            ? Math.round(((uniqueSessions - yesterdaySessions.length) / yesterdaySessions.length) * 100)
            : uniqueSessions > 0 ? 100 : 0;

        // ── 18. Actionable insights (auto-generated) ─────────
        const insights: string[] = [];

        if (bounceRate > 60) insights.push(`⚠️ Tỷ lệ thoát ${bounceRate}% — cần cải thiện nội dung trang đầu tiên để giữ chân người dùng.`);
        if (bounceRate <= 30 && uniqueSessions > 5) insights.push(`✅ Tỷ lệ thoát thấp ${bounceRate}% — người dùng tương tác tốt!`);
        if (avgDuration < 30 && uniqueSessions > 5) insights.push(`⚠️ Thời gian TB chỉ ${avgDuration}s — người dùng rời đi quá nhanh. Cần thêm nội dung hấp dẫn.`);
        if (avgDuration > 300) insights.push(`✅ Thời gian TB ${Math.floor(avgDuration / 60)}p${avgDuration % 60}s — engagement rất tốt!`);
        if (mobilePercent > 80) insights.push(`📱 ${mobilePercent}% truy cập từ mobile — đảm bảo tối ưu giao diện mobile.`);
        if (newUsers > returningUsers * 2 && realUsers > 5) insights.push(`🆕 Nhiều người dùng mới (${newUsers}/${realUsers}) — chiến lược marketing đang hiệu quả. Cần tăng retention.`);
        if (returningUsers > newUsers && realUsers > 5) insights.push(`🔄 Nhiều người quay lại (${returningUsers}/${realUsers}) — app có giá trị! Cần thêm nội dung mới.`);
        if (peakHour >= 19 && peakHour <= 22) insights.push(`🌙 Cao điểm ${peakHour}h — user học buổi tối. Cân nhắc push notification/nhắc nhở lúc 19h.`);
        if (peakHour >= 6 && peakHour <= 8) insights.push(`🌅 Cao điểm ${peakHour}h sáng — user học sớm trước khi đi làm/học.`);
        if (landingFunnel.visitors > 0 && conversionRate < 5) insights.push(`🔻 Tỷ lệ chuyển đổi landing chỉ ${conversionRate}% — cần tối ưu form đăng ký và CTA.`);
        if (conversionRate >= 10) insights.push(`🎯 Tỷ lệ chuyển đổi landing ${conversionRate}% — rất tốt!`);
        if ((eventBreakdown.exam_start ?? 0) > 0 && (eventBreakdown.exam_finish ?? 0) === 0) insights.push(`⚠️ Có ${eventBreakdown.exam_start} lần bắt đầu thi nhưng không ai hoàn thành — kiểm tra UX thi.`);
        if (viewsChange < -30 && yesterdayPageViews > 10) insights.push(`📉 Lượt xem giảm ${Math.abs(viewsChange)}% so với hôm qua — kiểm tra nguồn traffic.`);
        if (viewsChange > 50 && yesterdayPageViews > 5) insights.push(`📈 Lượt xem tăng ${viewsChange}% so với hôm qua!`);

        // ── 19. Site-specific stats ────────────────────────────
        type PayloadObj = Record<string, unknown>;
        const siteSpecificStats: Record<string, unknown> = {};
        if (siteFilter === "mophong" || !siteFilter) {
            const mEvents = siteFilter ? allEvents : allEvents.filter(e => e.site === "mophong");
            const scenarioViews: Record<string, number> = {};
            const videoPlays: Record<string, number> = {};
            let examStarts = 0, examFinishes = 0, totalBrakes = 0;
            mEvents.forEach(e => {
                const p = e.payload as PayloadObj | null;
                if (e.eventType === "scenario_view" && p) {
                    const k = String(p.title || p.scenarioId || p.scenario || "unknown"); scenarioViews[k] = (scenarioViews[k] || 0) + 1;
                }
                if (e.eventType === "video_play" && p) {
                    const k = String(p.src || p.video || "unknown"); videoPlays[k] = (videoPlays[k] || 0) + 1;
                }
                if (e.eventType === "exam_start") examStarts++;
                if (e.eventType === "exam_finish") examFinishes++;
                if (e.eventType === "scenario_brake") totalBrakes++;
            });
            siteSpecificStats.mophong = {
                topScenarios: Object.entries(scenarioViews).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([name, count]) => ({ name, count })),
                topVideos: Object.entries(videoPlays).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([name, count]) => ({ name, count })),
                examStarts, examFinishes,
                examCompletionRate: examStarts > 0 ? Math.round((examFinishes / examStarts) * 100) : 0,
                totalBrakes,
            };
        }
        if (siteFilter === "taplai" || !siteFilter) {
            const tEvents = siteFilter ? allEvents : allEvents.filter(e => e.site === "taplai");
            const topicViews: Record<string, number> = {};
            const searchQueries: Record<string, number> = {};
            let totalAnswers = 0, correctAnswers = 0, dailyPractices = 0, wrongReviews = 0;
            tEvents.forEach(e => {
                const p = e.payload as PayloadObj | null;
                if (e.eventType === "topic_view" && p?.topic) {
                    const k = String(p.topic); topicViews[k] = (topicViews[k] || 0) + 1;
                }
                if (e.eventType === "search_query" && p) {
                    const k = String(p.query || p.path || "unknown"); searchQueries[k] = (searchQueries[k] || 0) + 1;
                }
                if (e.eventType === "question_answer") {
                    totalAnswers++;
                    if (p?.correct) correctAnswers++;
                }
                if (e.eventType === "daily_practice") dailyPractices++;
                if (e.eventType === "wrong_review") wrongReviews++;
            });
            siteSpecificStats.taplai = {
                topTopics: Object.entries(topicViews).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([name, count]) => ({ name, count })),
                topSearches: Object.entries(searchQueries).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([name, count]) => ({ name, count })),
                totalAnswers, correctAnswers,
                correctRate: totalAnswers > 0 ? Math.round((correctAnswers / totalAnswers) * 100) : 0,
                dailyPractices, wrongReviews,
            };
        }
        if (siteFilter === "landing" || !siteFilter) {
            const lEvents = siteFilter ? allEvents : allEvents.filter(e => e.site === "landing");
            const sectionViews: Record<string, number> = {};
            lEvents.forEach(e => {
                const p = e.payload as PayloadObj | null;
                if (e.eventType === "section_view" && p?.section) {
                    const k = String(p.section); sectionViews[k] = (sectionViews[k] || 0) + 1;
                }
            });
            siteSpecificStats.landing = {
                topSections: Object.entries(sectionViews).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([name, count]) => ({ name, count })),
                funnelDetail: landingFunnel,
                conversionRate,
            };
        }

        return NextResponse.json({
            date,
            siteFilter: siteFilter || "all",
            // Core metrics
            totalPageViews,
            uniqueSessions,
            realUsers,
            newUsers,
            returningUsers,
            avgDuration,
            avgPagesPerSession,
            bounceRate,
            engagementRate,
            // Comparison
            viewsChange,
            sessionsChange,
            yesterdayPageViews,
            yesterdaySessions: yesterdaySessions.length,
            // Breakdowns
            topPages,
            eventBreakdown,
            deviceBreakdown: { mobile, desktop, mobilePercent },
            screenSizes,
            hourlyTraffic: hourly,
            peakHour,
            siteBreakdown,
            topReferrers,
            // User journey
            topEntryPages,
            topExitPages,
            // Landing funnel
            landingFunnel,
            conversionRate,
            // Site-specific
            siteSpecificStats,
            // Actionable
            insights,
        });
    } catch (err) {
        console.error("[analytics/dashboard.GET]", err);
        return NextResponse.json({ error: "Internal error" }, { status: 500 });
    }
}
