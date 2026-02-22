import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireMappedRoutePermissionAuth } from "@/lib/route-auth";
import { requireAdminRole } from "@/lib/admin-auth";

/**
 * AI Chatbot Analytics — answer natural language questions about analytics data.
 * POST /api/analytics/ai-chat
 * Body: { question: string, site?: string, range?: number }
 */
export async function POST(req: Request) {
    const authResult = await requireMappedRoutePermissionAuth(req);
    if (authResult.error) return authResult.error;
    const adminError = requireAdminRole(authResult.auth.role);
    if (adminError) return adminError;

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "OPENAI_API_KEY not configured" }, { status: 500 });

    const { question, site, range = 7 } = (await req.json()) as { question: string; site?: string; range?: number };
    if (!question || question.length < 3) return NextResponse.json({ error: "Câu hỏi quá ngắn" }, { status: 400 });

    const now = new Date();
    const dayEnd = now;
    const dayStart = new Date(now); dayStart.setDate(dayStart.getDate() - range);

    try {
        // Build DB context for AI
        const baseWhere = site
            ? { createdAt: { gte: dayStart, lte: dayEnd }, site }
            : { createdAt: { gte: dayStart, lte: dayEnd } };

        const allEvents = await prisma.siteAnalyticsEvent.findMany({
            where: baseWhere,
            select: { eventType: true, page: true, site: true, sessionId: true, createdAt: true, duration: true, payload: true, ip: true },
        });

        // Aggregate key metrics
        const pageViews = allEvents.filter(e => e.eventType === "page_view");
        const sessions = new Set(allEvents.map(e => e.sessionId)).size;
        const users = new Set(allEvents.filter(e => e.ip).map(e => e.ip)).size || sessions;

        type PayloadObj = Record<string, unknown>;
        const eventBreakdown: Record<string, number> = {};
        allEvents.forEach(e => { eventBreakdown[e.eventType] = (eventBreakdown[e.eventType] || 0) + 1; });

        // Top pages
        const pageCounts: Record<string, number> = {};
        pageViews.forEach(e => { pageCounts[e.page] = (pageCounts[e.page] || 0) + 1; });
        const topPages = Object.entries(pageCounts).sort((a, b) => b[1] - a[1]).slice(0, 10);

        // Site breakdown
        const siteCounts: Record<string, number> = {};
        pageViews.forEach(e => { siteCounts[e.site] = (siteCounts[e.site] || 0) + 1; });

        // Hourly
        const hourly: number[] = new Array(24).fill(0);
        pageViews.forEach(e => { hourly[(e.createdAt.getUTCHours() + 7) % 24]++; });

        // Mophong stats
        const mophongEvents = allEvents.filter(e => e.site === "mophong");
        const mophongExamStarts = mophongEvents.filter(e => e.eventType === "exam_start").length;
        const mophongExamFinishes = mophongEvents.filter(e => e.eventType === "exam_finish").length;
        const mophongBrakes = mophongEvents.filter(e => e.eventType === "scenario_brake").length;
        const scenarioViews: Record<string, number> = {};
        mophongEvents.filter(e => e.eventType === "scenario_view").forEach(e => {
            const p = e.payload as PayloadObj | null;
            const k = String(p?.title || p?.scenarioId || "unknown");
            scenarioViews[k] = (scenarioViews[k] || 0) + 1;
        });

        // Taplai stats
        const taplaiEvents = allEvents.filter(e => e.site === "taplai");
        const taplaiExamStarts = taplaiEvents.filter(e => e.eventType === "exam_start").length;
        const taplaiExamFinishes = taplaiEvents.filter(e => e.eventType === "exam_finish").length;
        const taplaiAnswers = taplaiEvents.filter(e => e.eventType === "question_answer").length;

        // Landing stats
        const landingEvents = allEvents.filter(e => e.site === "landing");
        const landingVisitors = new Set(landingEvents.filter(e => e.eventType === "page_view").map(e => e.sessionId)).size;
        const formSubmits = landingEvents.filter(e => e.eventType === "form_submit").length;
        const phoneCalls = landingEvents.filter(e => e.eventType === "phone_click").length;
        const zaloClicks = landingEvents.filter(e => e.eventType === "zalo_click").length;

        // UTM
        type UtmPayload = { utm?: { utm_source?: string; utm_medium?: string } };
        const utmSources: Record<string, number> = {};
        pageViews.forEach(e => {
            const utm = (e.payload as UtmPayload)?.utm;
            if (utm?.utm_source) {
                utmSources[`${utm.utm_source}/${utm.utm_medium || "(none)"}`] = (utmSources[`${utm.utm_source}/${utm.utm_medium || "(none)"}`] || 0) + 1;
            }
        });

        // Daily trend
        const dailyMap: Record<string, number> = {};
        pageViews.forEach(e => {
            const d = new Date(e.createdAt.getTime() + 7 * 3600 * 1000).toISOString().slice(0, 10);
            dailyMap[d] = (dailyMap[d] || 0) + 1;
        });

        const dbContext = {
            period: `${range} ngày gần nhất`,
            siteFilter: site || "tất cả",
            totalPageViews: pageViews.length,
            uniqueSessions: sessions,
            realUsers: users,
            eventBreakdown,
            topPages,
            siteBreakdown: siteCounts,
            hourlyTraffic: hourly,
            dailyTrend: dailyMap,
            utm: Object.entries(utmSources).sort((a, b) => b[1] - a[1]).slice(0, 5),
            mophong: { examStarts: mophongExamStarts, examFinishes: mophongExamFinishes, brakes: mophongBrakes, topScenarios: Object.entries(scenarioViews).sort((a, b) => b[1] - a[1]).slice(0, 5) },
            taplai: { examStarts: taplaiExamStarts, examFinishes: taplaiExamFinishes, totalAnswers: taplaiAnswers },
            landing: { visitors: landingVisitors, formSubmits, phoneCalls, zaloClicks, conversionRate: landingVisitors > 0 ? Math.round((formSubmits / landingVisitors) * 100) : 0 },
        };

        const systemPrompt = `Bạn là trợ lý AI phân tích analytics cho hệ thống quản lý đào tạo lái xe "Thầy Duy".
Bạn có quyền truy cập vào dữ liệu analytics thực từ 3 ứng dụng:
- Mô Phỏng: app luyện thi 120 tình huống giao thông
- Lý Thuyết (Taplai): app ôn 600 câu lý thuyết
- Landing: trang marketing thu lead

Dữ liệu ${range} ngày gần nhất:
${JSON.stringify(dbContext, null, 2)}

Quy tắc:
- Trả lời NGẮN GỌN, dùng emoji, markdown formatting
- Nếu được hỏi con số, trả lời CHÍNH XÁC từ dữ liệu
- Nếu không có dữ liệu, nói rõ "chưa có dữ liệu"
- Có thể tính toán từ dữ liệu (%, trung bình, so sánh)
- Dùng tiếng Việt`;

        const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
            body: JSON.stringify({
                model: "gpt-4o-mini",
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: question },
                ],
                max_tokens: 1000,
                temperature: 0.3,
            }),
        });

        if (!openaiRes.ok) {
            const err = await openaiRes.text();
            console.error("[ai-chat] OpenAI error:", err);
            return NextResponse.json({ error: "OpenAI error" }, { status: 502 });
        }

        const data = (await openaiRes.json()) as { choices: Array<{ message: { content: string } }> };
        const answer = data.choices?.[0]?.message?.content || "Không có câu trả lời.";

        return NextResponse.json({ question, answer, range, site: site || "all" });
    } catch (err) {
        console.error("[ai-chat.POST]", err);
        return NextResponse.json({ error: "Internal error" }, { status: 500 });
    }
}
