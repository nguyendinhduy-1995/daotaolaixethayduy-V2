import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireMappedRoutePermissionAuth } from "@/lib/route-auth";
import { requireAdminRole } from "@/lib/admin-auth";

export async function POST(req: Request) {
    const authResult = await requireMappedRoutePermissionAuth(req);
    if (authResult.error) return authResult.error;
    const adminError = requireAdminRole(authResult.auth.role);
    if (adminError) return adminError;

    const url = new URL(req.url);
    const date = url.searchParams.get("date") || new Date().toISOString().slice(0, 10);
    const range = parseInt(url.searchParams.get("range") || "1"); // 1, 7, 30
    const siteFilter = url.searchParams.get("site"); // mophong | taplai | landing | null

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
        return NextResponse.json({ error: "OPENAI_API_KEY is not configured" }, { status: 500 });
    }

    const dayEnd = new Date(`${date}T23:59:59.999+07:00`);
    const dayStart = range > 1
        ? (() => { const d = new Date(`${date}T00:00:00+07:00`); d.setDate(d.getDate() - range + 1); return d; })()
        : new Date(`${date}T00:00:00+07:00`);

    // Previous period for comparison
    const prevEnd = new Date(dayStart); prevEnd.setMilliseconds(-1);
    const prevStart = new Date(prevEnd); prevStart.setDate(prevStart.getDate() - range + 1); prevStart.setHours(0, 0, 0, 0);

    try {
        const baseWhere = siteFilter
            ? { createdAt: { gte: dayStart, lte: dayEnd }, site: siteFilter }
            : { createdAt: { gte: dayStart, lte: dayEnd } };
        const prevWhere = siteFilter
            ? { createdAt: { gte: prevStart, lte: prevEnd }, site: siteFilter }
            : { createdAt: { gte: prevStart, lte: prevEnd } };

        // ── Current period events ──
        const allEvents = await prisma.siteAnalyticsEvent.findMany({
            where: baseWhere,
            select: { eventType: true, page: true, site: true, sessionId: true, userAgent: true, createdAt: true, duration: true, payload: true, ip: true },
        });

        // ── Previous period counts ──
        const prevEventCount = await prisma.siteAnalyticsEvent.count({ where: { ...prevWhere, eventType: "page_view" } });
        const prevSessions = await prisma.siteAnalyticsEvent.findMany({ where: prevWhere, select: { sessionId: true }, distinct: ["sessionId"] });

        // ── Basic stats ──
        const pageViews = allEvents.filter(e => e.eventType === "page_view");
        const totalPageViews = pageViews.length;
        const sessionIds = new Set(allEvents.map(e => e.sessionId));
        const uniqueSessions = sessionIds.size;
        const uniqueIPs = new Set(allEvents.filter(e => e.ip).map(e => e.ip));
        const realUsers = uniqueIPs.size || uniqueSessions;

        // Duration
        const sessionEnds = allEvents.filter(e => e.eventType === "session_end" && e.duration);
        const avgDuration = sessionEnds.length > 0
            ? Math.round(sessionEnds.reduce((s, e) => s + (e.duration ?? 0), 0) / sessionEnds.length)
            : 0;

        // Event breakdown
        const eventBreakdown: Record<string, number> = {};
        allEvents.forEach(e => { eventBreakdown[e.eventType] = (eventBreakdown[e.eventType] || 0) + 1; });

        // Top pages with time
        type PayloadObj = Record<string, unknown>;
        const pageCounts: Record<string, number> = {};
        const pageDurations: Record<string, { total: number; count: number }> = {};
        allEvents.forEach(e => {
            if (e.eventType === "page_view") pageCounts[e.page] = (pageCounts[e.page] || 0) + 1;
            if (e.eventType === "page_duration") {
                const dur = (e.payload as PayloadObj)?.duration as number | undefined;
                if (dur && dur > 0) {
                    if (!pageDurations[e.page]) pageDurations[e.page] = { total: 0, count: 0 };
                    pageDurations[e.page].total += dur;
                    pageDurations[e.page].count++;
                }
            }
        });
        const topPages = Object.entries(pageCounts)
            .sort((a, b) => b[1] - a[1]).slice(0, 10)
            .map(([page, count]) => ({
                page, count,
                avgTimeSec: pageDurations[page] ? Math.round(pageDurations[page].total / pageDurations[page].count) : null,
            }));

        // Hourly
        const hourly: number[] = new Array(24).fill(0);
        pageViews.forEach(e => { hourly[(e.createdAt.getUTCHours() + 7) % 24]++; });
        const peakHour = hourly.indexOf(Math.max(...hourly));

        // Site breakdown
        const siteCounts: Record<string, number> = {};
        pageViews.forEach(e => { siteCounts[e.site] = (siteCounts[e.site] || 0) + 1; });

        // Device
        const mobileCount = new Set(allEvents.filter(e => {
            const ua = (e.userAgent || "").toLowerCase();
            return ua.includes("mobi") || ua.includes("android") || ua.includes("iphone");
        }).map(e => e.sessionId)).size;
        const mobilePercent = uniqueSessions > 0 ? Math.round((mobileCount / uniqueSessions) * 100) : 0;

        // ── Site-specific stats ──
        const siteStats: Record<string, unknown> = {};

        // Mophong
        const mEvents = allEvents.filter(e => siteFilter === "mophong" ? true : e.site === "mophong");
        if (mEvents.length > 0) {
            const examStarts = mEvents.filter(e => e.eventType === "exam_start").length;
            const examFinishes = mEvents.filter(e => e.eventType === "exam_finish").length;
            const brakes = mEvents.filter(e => e.eventType === "scenario_brake").length;
            const scenarioViews = mEvents.filter(e => e.eventType === "scenario_view").length;
            const topScenarios: Record<string, number> = {};
            mEvents.filter(e => e.eventType === "scenario_view").forEach(e => {
                const p = e.payload as PayloadObj | null;
                const k = String(p?.title || p?.scenarioId || "unknown");
                topScenarios[k] = (topScenarios[k] || 0) + 1;
            });
            siteStats.mophong = {
                examStarts, examFinishes, brakes, scenarioViews,
                completionRate: examStarts > 0 ? Math.round((examFinishes / examStarts) * 100) : 0,
                topScenarios: Object.entries(topScenarios).sort((a, b) => b[1] - a[1]).slice(0, 5),
            };
        }

        // Taplai
        const tEvents = allEvents.filter(e => siteFilter === "taplai" ? true : e.site === "taplai");
        if (tEvents.length > 0) {
            const examStarts = tEvents.filter(e => e.eventType === "exam_start").length;
            const examFinishes = tEvents.filter(e => e.eventType === "exam_finish").length;
            const totalAnswers = tEvents.filter(e => e.eventType === "question_answer").length;
            const dailyPractices = tEvents.filter(e => e.eventType === "daily_practice").length;
            const topTopics: Record<string, number> = {};
            tEvents.filter(e => e.eventType === "topic_view").forEach(e => {
                const p = e.payload as PayloadObj | null;
                const k = String(p?.topic || "unknown");
                topTopics[k] = (topTopics[k] || 0) + 1;
            });
            siteStats.taplai = {
                examStarts, examFinishes, totalAnswers, dailyPractices,
                completionRate: examStarts > 0 ? Math.round((examFinishes / examStarts) * 100) : 0,
                topTopics: Object.entries(topTopics).sort((a, b) => b[1] - a[1]).slice(0, 5),
            };
        }

        // Landing funnel
        const lEvents = allEvents.filter(e => siteFilter === "landing" ? true : e.site === "landing");
        if (lEvents.length > 0) {
            const visitors = new Set(lEvents.filter(e => e.eventType === "page_view").map(e => e.sessionId)).size;
            const formSubmitted = lEvents.filter(e => e.eventType === "form_submit").length;
            const ctaClicks = lEvents.filter(e => e.eventType === "cta_click").length;
            const phoneCalls = lEvents.filter(e => e.eventType === "phone_click").length;
            const zaloClicks = lEvents.filter(e => e.eventType === "zalo_click").length;
            siteStats.landing = {
                visitors, formSubmitted, ctaClicks, phoneCalls, zaloClicks,
                conversionRate: visitors > 0 ? Math.round((formSubmitted / visitors) * 100) : 0,
            };
        }

        // ── UTM sources ──
        type UtmPayload = { utm?: { utm_source?: string; utm_medium?: string; utm_campaign?: string } };
        const utmSources: Record<string, number> = {};
        pageViews.forEach(e => {
            const utm = (e.payload as UtmPayload)?.utm;
            if (utm?.utm_source) {
                const key = `${utm.utm_source}/${utm.utm_medium || "(none)"}`;
                utmSources[key] = (utmSources[key] || 0) + 1;
            }
        });

        // ── Performance ──
        type PerfPayload = { ttfb?: number; domReady?: number; load?: number };
        const perfEvents = allEvents.filter(e => e.eventType === "perf");
        const avgPerf = perfEvents.length > 0 ? {
            ttfb: Math.round(perfEvents.reduce((s, e) => s + ((e.payload as PerfPayload)?.ttfb || 0), 0) / perfEvents.length),
            domReady: Math.round(perfEvents.reduce((s, e) => s + ((e.payload as PerfPayload)?.domReady || 0), 0) / perfEvents.length),
            load: Math.round(perfEvents.reduce((s, e) => s + ((e.payload as PerfPayload)?.load || 0), 0) / perfEvents.length),
        } : null;

        // ── Error count ──
        const errorCount = allEvents.filter(e => e.eventType === "js_error").length;

        // ── User flows (top 5 session journeys) ──
        const sessionJourneys: Record<string, string[]> = {};
        allEvents.filter(e => e.eventType === "page_view").sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime()).forEach(e => {
            if (!sessionJourneys[e.sessionId]) sessionJourneys[e.sessionId] = [];
            const pages = sessionJourneys[e.sessionId];
            if (pages[pages.length - 1] !== e.page) pages.push(e.page);
        });
        const flowCounts: Record<string, number> = {};
        Object.values(sessionJourneys).forEach(pages => {
            const key = pages.slice(0, 5).join(" → ");
            if (key) flowCounts[key] = (flowCounts[key] || 0) + 1;
        });
        const topFlows = Object.entries(flowCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);

        // ── Build context for AI ──
        const viewsChange = prevEventCount > 0 ? Math.round(((totalPageViews - prevEventCount) / prevEventCount) * 100) : 100;
        const sessionsChange = prevSessions.length > 0 ? Math.round(((uniqueSessions - prevSessions.length) / prevSessions.length) * 100) : 100;

        const siteName = siteFilter === "mophong" ? "Mô Phỏng" : siteFilter === "taplai" ? "Học Lý Thuyết" : siteFilter === "landing" ? "Landing Page" : "Tất cả (Mô Phỏng + Lý Thuyết + Landing)";
        const dateLabel = range === 1 ? `ngày ${date}` : `${range} ngày (${dayStart.toISOString().slice(0, 10)} → ${date})`;

        const stats = {
            dateRange: dateLabel,
            site: siteName,
            totalPageViews,
            uniqueSessions,
            realUsers,
            avgDurationSeconds: avgDuration,
            mobilePercent: `${mobilePercent}%`,
            viewsVsPrevPeriod: `${viewsChange > 0 ? "+" : ""}${viewsChange}%`,
            sessionsVsPrevPeriod: `${sessionsChange > 0 ? "+" : ""}${sessionsChange}%`,
            eventBreakdown,
            topPages,
            siteBreakdown: siteCounts,
            peakHour,
            hourlyTraffic: hourly,
            topUserFlows: topFlows,
            utmSources: Object.entries(utmSources).sort((a, b) => b[1] - a[1]).slice(0, 5),
            performance: avgPerf,
            jsErrors: errorCount,
            siteSpecificStats: siteStats,
        };

        const prompt = `Bạn là chuyên gia phân tích hành vi người dùng website/app. Hãy phân tích dữ liệu analytics sau đây từ hệ thống quản lý trung tâm đào tạo lái xe "Thầy Duy" và đưa ra báo cáo chi tiết bằng tiếng Việt.

Site đang phân tích: ${siteName}
Khoảng thời gian: ${dateLabel}
So sánh với ${range} ngày trước đó: views ${viewsChange > 0 ? "+" : ""}${viewsChange}%, sessions ${sessionsChange > 0 ? "+" : ""}${sessionsChange}%

Dữ liệu:
${JSON.stringify(stats, null, 2)}

Hãy trả lời theo cấu trúc sau:

## 📊 Tổng quan
Tóm tắt ngắn gọn tình hình, highlight 2-3 con số quan trọng nhất.

## 🔥 Điểm nổi bật
- Những pattern đáng chú ý trong hành vi người dùng
- So sánh với kỳ trước, xu hướng tăng/giảm
${Object.keys(siteStats).length > 0 ? "- Phân tích data exam/scenario/topic cụ thể" : ""}

## 🛤️ Hành trình người dùng
- Phân tích top user flows (người dùng đi qua trang nào)
- Drop-off points: người dùng rời đi ở đâu nhiều nhất
- Gợi ý cải thiện luồng trải nghiệm

## ⏰ Thời gian & Thiết bị
- Phân tích giờ cao điểm, ý nghĩa
- Thời gian ở trên từng trang
- Phân bổ thiết bị mobile/desktop

${avgPerf ? `## ⚡ Hiệu năng & Lỗi
- Đánh giá tốc độ tải (TTFB, DOM, Full Load)
- Số lỗi JS và mức độ ảnh hưởng` : ""}

${Object.keys(utmSources).length > 0 ? `## 📣 Nguồn traffic
- Phân tích hiệu quả từng nguồn UTM
- Gợi ý tối ưu ngân sách quảng cáo` : ""}

## 💡 Gợi ý hành động (Top 5)
Đưa ra 5 action items CỤ THỂ, KHẢ THI nhất để cải thiện metrics. Mỗi gợi ý ghi rõ:
- Vấn đề cụ thể
- Hành động đề xuất
- Kết quả kỳ vọng

Lưu ý: Đây là website/app học lái xe. Mô Phỏng = app luyện thi mô phỏng tình huống giao thông 120 tình huống. Lý Thuyết = app ôn thi lý thuyết lái xe 600 câu. Landing = trang marketing thu lead đăng ký học.`;

        const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model: "gpt-4o-mini",
                messages: [
                    { role: "system", content: "Bạn là chuyên gia phân tích dữ liệu website và marketing digital cho ngành đào tạo lái xe tại Việt Nam. Trả lời bằng tiếng Việt, dùng emoji phù hợp, ngắn gọn nhưng sâu sắc. Dùng markdown formatting." },
                    { role: "user", content: prompt },
                ],
                max_tokens: 2500,
                temperature: 0.7,
            }),
        });

        if (!openaiRes.ok) {
            const errBody = await openaiRes.text();
            console.error("[ai-report] OpenAI error:", errBody);
            return NextResponse.json({ error: "OpenAI API error", detail: errBody }, { status: 502 });
        }

        const openaiData = (await openaiRes.json()) as {
            choices: Array<{ message: { content: string } }>;
        };
        const analysis = openaiData.choices?.[0]?.message?.content || "Không có kết quả phân tích.";

        return NextResponse.json({ date, range, site: siteFilter || "all", stats, analysis });
    } catch (err) {
        console.error("[analytics/ai-report.POST]", err);
        return NextResponse.json({ error: "Internal error" }, { status: 500 });
    }
}
