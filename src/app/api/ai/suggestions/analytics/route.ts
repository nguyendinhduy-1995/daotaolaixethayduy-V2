import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError } from "@/lib/api-response";
import { API_ERROR_VI } from "@/lib/api-error-vi";
import { requirePermissionRouteAuth } from "@/lib/route-auth";

/**
 * GET /api/ai/suggestions/analytics
 *
 * Returns feedback analytics for AI suggestions:
 *  - Total suggestions count
 *  - Feedback distribution (HELPFUL / NOT_HELPFUL / DONE)
 *  - Average rating
 *  - Top effective suggestions (most HELPFUL)
 *  - Ineffective suggestions (most NOT_HELPFUL)
 *
 * Query params: from (YYYY-MM-DD), to (YYYY-MM-DD)
 */
export async function GET(req: Request) {
    const authResult = await requirePermissionRouteAuth(req, { module: "ai_suggestions", action: "VIEW" });
    if (authResult.error) return authResult.error;

    try {
        const { searchParams } = new URL(req.url);
        const from = searchParams.get("from");
        const to = searchParams.get("to");

        const dateFilter: { createdAt?: { gte?: Date; lte?: Date } } = {};
        if (from && /^\d{4}-\d{2}-\d{2}$/.test(from)) {
            dateFilter.createdAt = { ...dateFilter.createdAt, gte: new Date(`${from}T00:00:00.000Z`) };
        }
        if (to && /^\d{4}-\d{2}-\d{2}$/.test(to)) {
            dateFilter.createdAt = { ...dateFilter.createdAt, lte: new Date(`${to}T23:59:59.999Z`) };
        }

        // Parallel queries
        const [
            totalSuggestions,
            totalFeedbacks,
            feedbackByType,
            avgRating,
            topHelpful,
            topNotHelpful,
            recentTrend,
        ] = await Promise.all([
            // Total suggestions
            prisma.aiSuggestion.count({ where: dateFilter }),

            // Total feedbacks
            prisma.aiSuggestionFeedback.count({ where: dateFilter }),

            // Feedback distribution by type
            prisma.aiSuggestionFeedback.groupBy({
                by: ["feedbackType"],
                _count: true,
                where: dateFilter,
            }),

            // Average rating
            prisma.aiSuggestionFeedback.aggregate({
                _avg: { rating: true },
                where: dateFilter,
            }),

            // Top 5 suggestions with most HELPFUL feedbacks
            prisma.aiSuggestion.findMany({
                where: {
                    ...dateFilter,
                    feedbacks: { some: { feedbackType: "HELPFUL" } },
                },
                select: {
                    id: true,
                    title: true,
                    dateKey: true,
                    scoreColor: true,
                    source: true,
                    _count: { select: { feedbacks: { where: { feedbackType: "HELPFUL" } } } },
                },
                orderBy: { feedbacks: { _count: "desc" } },
                take: 5,
            }),

            // Top 5 suggestions with most NOT_HELPFUL feedbacks
            prisma.aiSuggestion.findMany({
                where: {
                    ...dateFilter,
                    feedbacks: { some: { feedbackType: "NOT_HELPFUL" } },
                },
                select: {
                    id: true,
                    title: true,
                    dateKey: true,
                    scoreColor: true,
                    source: true,
                    _count: { select: { feedbacks: { where: { feedbackType: "NOT_HELPFUL" } } } },
                },
                orderBy: { feedbacks: { _count: "desc" } },
                take: 5,
            }),

            // Daily trend (last 14 days)
            prisma.aiSuggestionFeedback.groupBy({
                by: ["feedbackType"],
                _count: true,
                where: {
                    createdAt: { gte: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000) },
                },
            }),
        ]);

        const distribution = Object.fromEntries(
            feedbackByType.map((row) => [row.feedbackType, row._count])
        );

        return NextResponse.json({
            totalSuggestions,
            totalFeedbacks,
            distribution: {
                HELPFUL: distribution.HELPFUL ?? 0,
                NOT_HELPFUL: distribution.NOT_HELPFUL ?? 0,
                DONE: distribution.DONE ?? 0,
            },
            avgRating: avgRating._avg.rating ?? 0,
            topHelpful: topHelpful.map((s) => ({
                id: s.id,
                title: s.title,
                dateKey: s.dateKey,
                scoreColor: s.scoreColor,
                source: s.source,
                helpfulCount: s._count.feedbacks,
            })),
            topNotHelpful: topNotHelpful.map((s) => ({
                id: s.id,
                title: s.title,
                dateKey: s.dateKey,
                scoreColor: s.scoreColor,
                source: s.source,
                notHelpfulCount: s._count.feedbacks,
            })),
            recentTrend: recentTrend.map((row) => ({
                type: row.feedbackType,
                count: row._count,
            })),
        });
    } catch (err) {
    console.error("[ai.suggestions.analytics]", err);
        return jsonError(500, "INTERNAL_ERROR", API_ERROR_VI.internal);
    }
}
