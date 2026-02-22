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

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
        return NextResponse.json(
            { error: "OPENAI_API_KEY is not configured" },
            { status: 500 }
        );
    }

    const dayStart = new Date(`${date}T00:00:00+07:00`);
    const dayEnd = new Date(`${date}T23:59:59.999+07:00`);

    try {
        // Gather aggregated stats for AI analysis
        const totalPageViews = await prisma.siteAnalyticsEvent.count({
            where: { eventType: "page_view", createdAt: { gte: dayStart, lte: dayEnd } },
        });

        const uniqueSessionsResult = await prisma.siteAnalyticsEvent.findMany({
            where: { createdAt: { gte: dayStart, lte: dayEnd } },
            select: { sessionId: true },
            distinct: ["sessionId"],
        });

        const durationEvents = await prisma.siteAnalyticsEvent.findMany({
            where: { eventType: "session_end", createdAt: { gte: dayStart, lte: dayEnd }, duration: { not: null } },
            select: { duration: true },
        });
        const avgDuration = durationEvents.length > 0
            ? Math.round(durationEvents.reduce((sum, e) => sum + (e.duration ?? 0), 0) / durationEvents.length)
            : 0;

        const allEvents = await prisma.siteAnalyticsEvent.findMany({
            where: { createdAt: { gte: dayStart, lte: dayEnd } },
            select: { eventType: true, page: true, site: true },
        });
        const eventBreakdown: Record<string, number> = {};
        const pageCounts: Record<string, number> = {};
        const siteCounts: Record<string, number> = {};
        allEvents.forEach((e) => {
            eventBreakdown[e.eventType] = (eventBreakdown[e.eventType] || 0) + 1;
            if (e.eventType === "page_view") {
                pageCounts[e.page] = (pageCounts[e.page] || 0) + 1;
                siteCounts[e.site] = (siteCounts[e.site] || 0) + 1;
            }
        });

        const topPages = Object.entries(pageCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([page, count]) => ({ page, count }));

        const hourlyEvents = await prisma.siteAnalyticsEvent.findMany({
            where: { eventType: "page_view", createdAt: { gte: dayStart, lte: dayEnd } },
            select: { createdAt: true },
        });
        const hourly: number[] = new Array(24).fill(0);
        hourlyEvents.forEach((e) => {
            const hour = (e.createdAt.getUTCHours() + 7) % 24;
            hourly[hour]++;
        });
        const peakHour = hourly.indexOf(Math.max(...hourly));

        // Build prompt for OpenAI
        const stats = {
            date,
            totalPageViews,
            uniqueSessions: uniqueSessionsResult.length,
            avgDurationSeconds: avgDuration,
            eventBreakdown,
            topPages,
            siteBreakdown: siteCounts,
            peakHour,
            hourlyTraffic: hourly,
        };

        const prompt = `Bạn là chuyên gia phân tích hành vi người dùng website. Hãy phân tích dữ liệu analytics sau đây từ hệ thống quản lý trung tâm đào tạo lái xe "Thầy Duy" và đưa ra báo cáo chi tiết bằng tiếng Việt.

Dữ liệu ngày ${date}:
${JSON.stringify(stats, null, 2)}

Hãy trả lời theo cấu trúc sau:
1. **Tổng quan**: Tóm tắt tình hình truy cập trong ngày
2. **Điểm nổi bật**: Những điểm đáng chú ý về hành vi người dùng
3. **Giờ cao điểm**: Phân tích thời gian truy cập nhiều nhất và ý nghĩa
4. **Trang phổ biến**: Phân tích các trang được truy cập nhiều nhất
5. **Tương tác người dùng**: Đánh giá mức độ tương tác (clicks, video, scroll)
6. **Gợi ý cải thiện**: Đưa ra 3-5 gợi ý cụ thể để cải thiện trải nghiệm và tăng engagement

Lưu ý: Đây là website/app học lái xe, người dùng chủ yếu là học viên đang ôn tập lý thuyết và mô phỏng.`;

        const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model: "gpt-4o-mini",
                messages: [
                    { role: "system", content: "Bạn là chuyên gia phân tích dữ liệu website, trả lời bằng tiếng Việt." },
                    { role: "user", content: prompt },
                ],
                max_tokens: 1500,
                temperature: 0.7,
            }),
        });

        if (!openaiRes.ok) {
            const errBody = await openaiRes.text();
            console.error("[ai-report] OpenAI error:", errBody);
            return NextResponse.json(
                { error: "OpenAI API error", detail: errBody },
                { status: 502 }
            );
        }

        const openaiData = (await openaiRes.json()) as {
            choices: Array<{ message: { content: string } }>;
        };
        const analysis = openaiData.choices?.[0]?.message?.content || "Không có kết quả phân tích.";

        return NextResponse.json({
            date,
            stats,
            analysis,
        });
    } catch (err) {
        console.error("[analytics/ai-report.POST]", err);
        return NextResponse.json(
            { error: "Internal error" },
            { status: 500 }
        );
    }
}
