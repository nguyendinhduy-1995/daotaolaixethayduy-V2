import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError } from "@/lib/api-response";
import { API_ERROR_VI } from "@/lib/api-error-vi";
import { requirePermissionRouteAuth } from "@/lib/route-auth";
import type { Prisma } from "@prisma/client";

/**
 * GET /api/ai/suggestions/summary
 *
 * Returns a 1-line AI summary for the dashboard:
 *  - Top priority suggestion title
 *  - Quick actionable insight
 *
 * Query params: date (YYYY-MM-DD, defaults to today)
 */
export async function GET(req: Request) {
    const authResult = await requirePermissionRouteAuth(req, { module: "ai_suggestions", action: "VIEW" });
    if (authResult.error) return authResult.error;

    try {
        const { searchParams } = new URL(req.url);
        const dateParam = searchParams.get("date");

        // Default to today in Ho Chi Minh timezone
        const now = new Date();
        const hcmOffset = 7 * 60; // UTC+7
        const hcmDate = new Date(now.getTime() + hcmOffset * 60 * 1000);
        const dateKey = dateParam || hcmDate.toISOString().slice(0, 10);

        const where: Prisma.AiSuggestionWhereInput = {
            dateKey,
            status: "ACTIVE",
            ...(authResult.auth.role !== "admin" && authResult.auth.role !== "super_admin"
                ? { ownerId: authResult.auth.sub }
                : {}),
        };

        // Get top suggestion by priority (RED > YELLOW > GREEN)
        const suggestions = await prisma.aiSuggestion.findMany({
            where,
            orderBy: [{ scoreColor: "asc" }, { createdAt: "desc" }],
            take: 3,
            select: {
                id: true,
                title: true,
                scoreColor: true,
                content: true,
            },
        });

        if (suggestions.length === 0) {
            return NextResponse.json({
                hasSummary: false,
                summary: "Chưa có gợi ý nào cho hôm nay",
                topSuggestion: null,
                totalActive: 0,
            });
        }

        const totalActive = await prisma.aiSuggestion.count({ where });
        const top = suggestions[0];

        // Build summary sentence
        const urgencyLabel = top.scoreColor === "RED" ? "🔴 Cần xử lý ngay" : top.scoreColor === "YELLOW" ? "🟡 Nên chú ý" : "🟢 Tình hình tốt";
        const summary = `${urgencyLabel}: ${top.title}`;

        return NextResponse.json({
            hasSummary: true,
            summary,
            topSuggestion: {
                id: top.id,
                title: top.title,
                scoreColor: top.scoreColor,
                preview: top.content.slice(0, 120),
            },
            totalActive,
        });
    } catch (err) {
    console.error("[ai.suggestions.summary]", err);
        return jsonError(500, "INTERNAL_ERROR", API_ERROR_VI.internal);
    }
}
