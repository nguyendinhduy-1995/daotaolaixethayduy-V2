import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError } from "@/lib/api-response";
import { API_ERROR_VI } from "@/lib/api-error-vi";
import { requirePermissionRouteAuth } from "@/lib/route-auth";

/**
 * GET /api/ai/suggestions/trend
 *
 * Returns trend comparison for AI suggestions:
 *  - Current week vs previous week
 *  - Current month vs previous month
 *  - Feedback improvement rate
 *
 * Query params: date (YYYY-MM-DD, defaults to today)
 */
export async function GET(req: Request) {
    const authResult = await requirePermissionRouteAuth(req, { module: "ai_suggestions", action: "VIEW" });
    if (authResult.error) return authResult.error;

    try {
        const { searchParams } = new URL(req.url);
        const dateParam = searchParams.get("date");

        const now = new Date();
        const hcmOffset = 7 * 60;
        const hcmDate = new Date(now.getTime() + hcmOffset * 60 * 1000);
        const todayStr = dateParam || hcmDate.toISOString().slice(0, 10);

        // Calculate date ranges
        const today = new Date(`${todayStr}T00:00:00.000Z`);
        const weekStart = new Date(today.getTime() - today.getUTCDay() * 24 * 60 * 60 * 1000);
        const prevWeekStart = new Date(weekStart.getTime() - 7 * 24 * 60 * 60 * 1000);
        const monthStart = new Date(today.getUTCFullYear(), today.getUTCMonth(), 1);
        const prevMonthStart = new Date(today.getUTCFullYear(), today.getUTCMonth() - 1, 1);

        const [
            thisWeekCount,
            prevWeekCount,
            thisMonthCount,
            prevMonthCount,
            thisWeekHelpful,
            prevWeekHelpful,
            thisWeekNotHelpful,
            prevWeekNotHelpful,
            scoreDistribution,
        ] = await Promise.all([
            // This week suggestions
            prisma.aiSuggestion.count({
                where: { createdAt: { gte: weekStart, lte: today } },
            }),
            // Previous week suggestions
            prisma.aiSuggestion.count({
                where: { createdAt: { gte: prevWeekStart, lt: weekStart } },
            }),
            // This month suggestions
            prisma.aiSuggestion.count({
                where: { createdAt: { gte: monthStart, lte: today } },
            }),
            // Previous month suggestions
            prisma.aiSuggestion.count({
                where: { createdAt: { gte: prevMonthStart, lt: monthStart } },
            }),
            // This week helpful feedback
            prisma.aiSuggestionFeedback.count({
                where: { feedbackType: "HELPFUL", createdAt: { gte: weekStart, lte: today } },
            }),
            // Previous week helpful feedback
            prisma.aiSuggestionFeedback.count({
                where: { feedbackType: "HELPFUL", createdAt: { gte: prevWeekStart, lt: weekStart } },
            }),
            // This week not helpful feedback
            prisma.aiSuggestionFeedback.count({
                where: { feedbackType: "NOT_HELPFUL", createdAt: { gte: weekStart, lte: today } },
            }),
            // Previous week not helpful feedback
            prisma.aiSuggestionFeedback.count({
                where: { feedbackType: "NOT_HELPFUL", createdAt: { gte: prevWeekStart, lt: weekStart } },
            }),
            // Score color distribution this week
            prisma.aiSuggestion.groupBy({
                by: ["scoreColor"],
                _count: true,
                where: { createdAt: { gte: weekStart, lte: today } },
            }),
        ]);

        const pctChange = (curr: number, prev: number) => {
            if (prev === 0) return curr > 0 ? 100 : 0;
            return Math.round(((curr - prev) / prev) * 100);
        };

        const colorDist = Object.fromEntries(
            scoreDistribution.map((row) => [row.scoreColor, row._count])
        );

        return NextResponse.json({
            weekly: {
                current: thisWeekCount,
                previous: prevWeekCount,
                changePct: pctChange(thisWeekCount, prevWeekCount),
            },
            monthly: {
                current: thisMonthCount,
                previous: prevMonthCount,
                changePct: pctChange(thisMonthCount, prevMonthCount),
            },
            feedback: {
                helpfulThisWeek: thisWeekHelpful,
                helpfulPrevWeek: prevWeekHelpful,
                helpfulChangePct: pctChange(thisWeekHelpful, prevWeekHelpful),
                notHelpfulThisWeek: thisWeekNotHelpful,
                notHelpfulPrevWeek: prevWeekNotHelpful,
                notHelpfulChangePct: pctChange(thisWeekNotHelpful, prevWeekNotHelpful),
            },
            scoreDistribution: {
                RED: colorDist.RED ?? 0,
                YELLOW: colorDist.YELLOW ?? 0,
                GREEN: colorDist.GREEN ?? 0,
            },
        });
    } catch (err) {
    console.error("[ai.suggestions.trend]", err);
        return jsonError(500, "INTERNAL_ERROR", API_ERROR_VI.internal);
    }
}
