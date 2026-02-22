import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * Auto-Insights + Anomaly Detection — runs daily (or on-demand via API)
 * POST /api/analytics/auto-insights
 * 
 * Can be triggered by:
 * - N8N cron webhook (with CRON_SECRET header)
 * - Admin manually (with auth)
 */
export async function POST(req: Request) {
    // Auth: check cron secret OR admin auth
    const cronSecret = req.headers.get("x-cron-secret");
    const validCron = cronSecret && cronSecret === (process.env.CRON_SECRET || "analytics-cron-2026");

    if (!validCron) {
        // Fallback to admin auth
        const { requireMappedRoutePermissionAuth } = await import("@/lib/route-auth");
        const { requireAdminRole } = await import("@/lib/admin-auth");
        const authResult = await requireMappedRoutePermissionAuth(req);
        if (authResult.error) return authResult.error;
        const adminError = requireAdminRole(authResult.auth.role);
        if (adminError) return adminError;
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "OPENAI_API_KEY not configured" }, { status: 500 });

    const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
    const date = yesterday.toISOString().slice(0, 10);

    // Check if already generated for this date
    const existing = await prisma.analyticsAiInsight.findFirst({
        where: { date, type: "daily_report" },
    });
    if (existing) {
        return NextResponse.json({ ok: true, message: "Đã có insight cho ngày " + date, id: existing.id });
    }

    const dayStart = new Date(`${date}T00:00:00+07:00`);
    const dayEnd = new Date(`${date}T23:59:59.999+07:00`);

    // Previous day for comparison
    const prevStart = new Date(dayStart); prevStart.setDate(prevStart.getDate() - 1);
    const prevEnd = new Date(dayStart); prevEnd.setMilliseconds(-1);

    // 7-day avg for anomaly baseline
    const weekStart = new Date(dayStart); weekStart.setDate(weekStart.getDate() - 7);

    try {
        // ── Current day events ──
        const allEvents = await prisma.siteAnalyticsEvent.findMany({
            where: { createdAt: { gte: dayStart, lte: dayEnd } },
            select: { eventType: true, page: true, site: true, sessionId: true, createdAt: true, duration: true, payload: true, ip: true },
        });

        const prevDayViews = await prisma.siteAnalyticsEvent.count({
            where: { createdAt: { gte: prevStart, lte: prevEnd }, eventType: "page_view" },
        });

        const weekEvents = await prisma.siteAnalyticsEvent.count({
            where: { createdAt: { gte: weekStart, lt: dayStart }, eventType: "page_view" },
        });
        const weekAvgViews = Math.round(weekEvents / 7);

        // ── Metrics ──
        const pageViews = allEvents.filter(e => e.eventType === "page_view").length;
        const sessions = new Set(allEvents.map(e => e.sessionId)).size;
        const users = new Set(allEvents.filter(e => e.ip).map(e => e.ip)).size || sessions;
        const errorCount = allEvents.filter(e => e.eventType === "js_error").length;

        // Site breakdown
        const siteCounts: Record<string, number> = {};
        allEvents.filter(e => e.eventType === "page_view").forEach(e => { siteCounts[e.site] = (siteCounts[e.site] || 0) + 1; });

        // Event breakdown
        const eventBreakdown: Record<string, number> = {};
        allEvents.forEach(e => { eventBreakdown[e.eventType] = (eventBreakdown[e.eventType] || 0) + 1; });

        // ── Anomaly Detection ──
        const anomalies: string[] = [];
        const viewsChange = prevDayViews > 0 ? Math.round(((pageViews - prevDayViews) / prevDayViews) * 100) : 0;
        const weekDeviation = weekAvgViews > 0 ? Math.round(((pageViews - weekAvgViews) / weekAvgViews) * 100) : 0;

        if (viewsChange < -40) anomalies.push(`📉 Traffic giảm ${Math.abs(viewsChange)}% so với hôm trước (${pageViews} vs ${prevDayViews})`);
        if (viewsChange > 100) anomalies.push(`📈 Traffic tăng đột biến ${viewsChange}% so với hôm trước`);
        if (weekDeviation < -50) anomalies.push(`⚠️ Traffic thấp hơn trung bình 7 ngày ${Math.abs(weekDeviation)}%`);
        if (errorCount > 10) anomalies.push(`🐛 ${errorCount} lỗi JavaScript — cần kiểm tra`);
        if (errorCount > 50) anomalies.push(`🚨 CRITICAL: ${errorCount} lỗi JS — ảnh hưởng nghiêm trọng trải nghiệm`);
        if (sessions > 5 && pageViews / sessions < 1.2) anomalies.push(`⚠️ Chỉ ${(pageViews / sessions).toFixed(1)} trang/phiên — bounce rate quá cao`);

        const severity = anomalies.some(a => a.includes("CRITICAL")) ? "critical"
            : anomalies.length > 0 ? "warning" : "info";

        // ── Store anomalies if any ──
        if (anomalies.length > 0) {
            await prisma.analyticsAiInsight.create({
                data: {
                    date,
                    type: "anomaly",
                    title: `⚠️ Phát hiện ${anomalies.length} bất thường`,
                    content: anomalies.join("\n"),
                    severity,
                    metrics: { pageViews, sessions, users, errorCount, viewsChange, weekDeviation },
                },
            });
        }

        // ── AI Daily Report ──
        const stats = {
            date,
            pageViews,
            sessions,
            users,
            errorCount,
            vsYesterday: `${viewsChange > 0 ? "+" : ""}${viewsChange}%`,
            vsWeekAvg: `${weekDeviation > 0 ? "+" : ""}${weekDeviation}%`,
            siteBreakdown: siteCounts,
            eventBreakdown,
            anomaliesFound: anomalies,
        };

        const prompt = `Phân tích ngắn gọn dữ liệu analytics ngày ${date} cho hệ thống đào tạo lái xe "Thầy Duy":

${JSON.stringify(stats, null, 2)}

Trả lời gồm:
1. **Tóm tắt 1 dòng** (headline)
2. **3 điểm chính** quan trọng nhất
3. **2 gợi ý** hành động cụ thể
${anomalies.length > 0 ? `4. **Cảnh báo**: ${anomalies.join("; ")}` : ""}

Ngắn gọn, dùng emoji, tiếng Việt.`;

        const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
            body: JSON.stringify({
                model: "gpt-4o-mini",
                messages: [
                    { role: "system", content: "Bạn là chuyên gia analytics. Phân tích data và đưa insight ngắn gọn, tiếng Việt." },
                    { role: "user", content: prompt },
                ],
                max_tokens: 800,
                temperature: 0.5,
            }),
        });

        let aiContent = "Không thể tạo báo cáo AI.";
        let aiTitle = `📊 Báo cáo ngày ${date}`;
        if (openaiRes.ok) {
            const data = (await openaiRes.json()) as { choices: Array<{ message: { content: string } }> };
            aiContent = data.choices?.[0]?.message?.content || aiContent;
            // Extract first line as title
            const firstLine = aiContent.split("\n").find(l => l.trim().length > 0);
            if (firstLine) aiTitle = firstLine.replace(/^[#*\s]+/, "").slice(0, 100);
        }

        const insight = await prisma.analyticsAiInsight.create({
            data: {
                date,
                type: "daily_report",
                title: aiTitle,
                content: aiContent,
                severity,
                metrics: stats,
            },
        });

        return NextResponse.json({
            ok: true,
            id: insight.id,
            date,
            title: aiTitle,
            anomalies: anomalies.length,
            severity,
        });
    } catch (err) {
        console.error("[auto-insights.POST]", err);
        return NextResponse.json({ error: "Internal error" }, { status: 500 });
    }
}

/**
 * GET /api/analytics/auto-insights — fetch recent insights
 */
export async function GET(req: Request) {
    const { requireMappedRoutePermissionAuth } = await import("@/lib/route-auth");
    const { requireAdminRole } = await import("@/lib/admin-auth");
    const authResult = await requireMappedRoutePermissionAuth(req);
    if (authResult.error) return authResult.error;
    const adminError = requireAdminRole(authResult.auth.role);
    if (adminError) return adminError;

    const url = new URL(req.url);
    const limit = parseInt(url.searchParams.get("limit") || "10");
    const type = url.searchParams.get("type"); // daily_report | anomaly | null

    const where = type ? { type } : {};

    const insights = await prisma.analyticsAiInsight.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: Math.min(limit, 50),
    });

    const unreadCount = await prisma.analyticsAiInsight.count({
        where: { read: false },
    });

    return NextResponse.json({ insights, unreadCount });
}
