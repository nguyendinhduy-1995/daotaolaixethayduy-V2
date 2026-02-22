import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError } from "@/lib/api-response";
import { requirePermissionRouteAuth } from "@/lib/route-auth";

/**
 * AI Lead Scoring — GET /api/leads/scoring
 * 
 * Calculates a 0-100 score for each lead based on:
 * - Status progression (NEW → HAS_PHONE → APPOINTED → ARRIVED → SIGNED)
 * - Call outcome quality
 * - Appointment outcome
 * - Number of interactions (events, messages)
 * - Response time (time from creation to first contact)
 * - Source/channel quality (organic vs paid)
 * - Recency of last contact
 * 
 * Returns leads sorted by score desc with tier labels (🔥 Nóng / 🌤️ Ấm / ❄️ Lạnh)
 */

type LeadScoreResult = {
    id: string;
    fullName: string | null;
    phone: string | null;
    status: string;
    source: string | null;
    score: number;
    tier: "HOT" | "WARM" | "COLD";
    tierLabel: string;
    tierEmoji: string;
    factors: string[];
    createdAt: Date;
    lastContactAt: Date | null;
};

// ── Scoring weights ──
const STATUS_SCORES: Record<string, number> = {
    NEW: 5,
    HAS_PHONE: 15,
    APPOINTED: 35,
    ARRIVED: 55,
    SIGNED: 80,
    STUDYING: 90,
    EXAMED: 95,
    RESULT: 100,
    LOST: 0,
};

const CALL_SCORES: Record<string, number> = {
    interested: 20,
    call_back: 10,
    no_answer: 0,
    not_interested: -10,
    wrong_number: -20,
};

const APPT_SCORES: Record<string, number> = {
    confirmed: 15,
    rescheduled: 5,
    cancelled: -5,
    no_show: -15,
};

const ARRIVAL_SCORES: Record<string, number> = {
    arrived_ok: 20,
    arrived_waiting: 10,
    arrived_refused: -10,
};

// Higher-value sources
const SOURCE_BONUS: Record<string, number> = {
    referral: 10,
    organic: 5,
    facebook: 3,
    zalo: 3,
    google: 5,
};

function scoreLead(lead: {
    status: string;
    callOutcome: string | null;
    apptOutcome: string | null;
    arrivalOutcome: string | null;
    source: string | null;
    events: { type: string; createdAt: Date }[];
    messages: { createdAt: Date }[];
    lastContactAt: Date | null;
    createdAt: Date;
}): { score: number; factors: string[] } {
    const factors: string[] = [];
    let score = 0;

    // 1. Status progression (0-100 base)
    const statusScore = STATUS_SCORES[lead.status] ?? 5;
    score += statusScore * 0.4; // 40% weight
    if (statusScore >= 55) factors.push(`Trạng thái: ${lead.status} (+${Math.round(statusScore * 0.4)})`);

    // 2. Call outcome
    if (lead.callOutcome) {
        const callScore = CALL_SCORES[lead.callOutcome] ?? 0;
        score += callScore * 0.15;
        if (callScore > 0) factors.push(`Kết quả gọi: ${lead.callOutcome === "interested" ? "Quan tâm" : "Gọi lại"} (+${Math.round(callScore * 0.15)})`);
        if (callScore < 0) factors.push(`Kết quả gọi: ${lead.callOutcome === "not_interested" ? "Không quan tâm" : "Sai số"} (${Math.round(callScore * 0.15)})`);
    }

    // 3. Appointment outcome
    if (lead.apptOutcome) {
        const apptScore = APPT_SCORES[lead.apptOutcome] ?? 0;
        score += apptScore * 0.1;
        if (apptScore > 0) factors.push(`Lịch hẹn: ${lead.apptOutcome === "confirmed" ? "Đã xác nhận" : "Đổi lịch"}`);
    }

    // 4. Arrival outcome
    if (lead.arrivalOutcome) {
        const arrivalScore = ARRIVAL_SCORES[lead.arrivalOutcome] ?? 0;
        score += arrivalScore * 0.1;
        if (arrivalScore > 0) factors.push(`Đến nơi: OK`);
    }

    // 5. Interaction count (events + messages)
    const interactionCount = lead.events.length + lead.messages.length;
    const interactionScore = Math.min(interactionCount * 3, 15); // max 15
    score += interactionScore;
    if (interactionCount > 0) factors.push(`${interactionCount} tương tác (+${interactionScore})`);

    // 6. Response time (time from creation to first event/contact)
    if (lead.lastContactAt) {
        const hoursSinceCreate = (lead.lastContactAt.getTime() - lead.createdAt.getTime()) / (1000 * 60 * 60);
        if (hoursSinceCreate <= 1) {
            score += 10;
            factors.push("Phản hồi <1 giờ (+10)");
        } else if (hoursSinceCreate <= 24) {
            score += 5;
            factors.push("Phản hồi <24 giờ (+5)");
        }
    }

    // 7. Source bonus
    if (lead.source) {
        const srcLower = lead.source.toLowerCase();
        for (const [key, bonus] of Object.entries(SOURCE_BONUS)) {
            if (srcLower.includes(key)) {
                score += bonus;
                factors.push(`Nguồn: ${lead.source} (+${bonus})`);
                break;
            }
        }
    }

    // 8. Recency penalty — leads not contacted in 7+ days lose points
    if (lead.lastContactAt) {
        const daysSinceContact = (Date.now() - lead.lastContactAt.getTime()) / (1000 * 60 * 60 * 24);
        if (daysSinceContact > 14) {
            score -= 10;
            factors.push(`Không liên hệ ${Math.round(daysSinceContact)} ngày (-10)`);
        } else if (daysSinceContact > 7) {
            score -= 5;
            factors.push(`Không liên hệ ${Math.round(daysSinceContact)} ngày (-5)`);
        }
    } else if (lead.status !== "NEW") {
        score -= 5;
        factors.push("Chưa liên hệ (-5)");
    }

    // Clamp 0-100
    score = Math.max(0, Math.min(100, Math.round(score)));

    return { score, factors };
}

function getTier(score: number): { tier: "HOT" | "WARM" | "COLD"; tierLabel: string; tierEmoji: string } {
    if (score >= 60) return { tier: "HOT", tierLabel: "Nóng", tierEmoji: "🔥" };
    if (score >= 30) return { tier: "WARM", tierLabel: "Ấm", tierEmoji: "🌤️" };
    return { tier: "COLD", tierLabel: "Lạnh", tierEmoji: "❄️" };
}

export async function GET(req: Request) {
    const authResult = await requirePermissionRouteAuth(req, { module: "leads", action: "VIEW" });
    if (authResult.error) return authResult.error;

    try {
        const url = new URL(req.url);
        const tier = url.searchParams.get("tier")?.toUpperCase(); // HOT, WARM, COLD
        const limit = Math.min(200, Math.max(1, Number(url.searchParams.get("limit")) || 50));

        // Fetch active leads with events and messages
        const leads = await prisma.lead.findMany({
            where: {
                status: { not: "LOST" as never },
            },
            orderBy: { createdAt: "desc" },
            take: 500, // score top 500 then filter
            include: {
                events: { select: { type: true, createdAt: true }, orderBy: { createdAt: "asc" } },
                messages: { select: { createdAt: true }, orderBy: { createdAt: "asc" } },
            },
        });

        // Score all leads
        let results: LeadScoreResult[] = leads.map(lead => {
            const { score, factors } = scoreLead({
                status: lead.status,
                callOutcome: lead.callOutcome,
                apptOutcome: lead.apptOutcome,
                arrivalOutcome: lead.arrivalOutcome,
                source: lead.source,
                events: lead.events,
                messages: lead.messages,
                lastContactAt: lead.lastContactAt,
                createdAt: lead.createdAt,
            });
            const tierInfo = getTier(score);

            return {
                id: lead.id,
                fullName: lead.fullName,
                phone: lead.phone,
                status: lead.status,
                source: lead.source,
                score,
                ...tierInfo,
                factors,
                createdAt: lead.createdAt,
                lastContactAt: lead.lastContactAt,
            };
        });

        // Sort by score desc
        results.sort((a, b) => b.score - a.score);

        // Filter by tier if specified
        if (tier && ["HOT", "WARM", "COLD"].includes(tier)) {
            results = results.filter(r => r.tier === tier);
        }

        // Limit
        results = results.slice(0, limit);

        // Summary stats
        const allScoredCount = leads.length;
        const hotCount = leads.filter(l => getTier(scoreLead({ ...l, events: l.events, messages: l.messages }).score).tier === "HOT").length;
        const warmCount = leads.filter(l => getTier(scoreLead({ ...l, events: l.events, messages: l.messages }).score).tier === "WARM").length;
        const coldCount = allScoredCount - hotCount - warmCount;

        return NextResponse.json({
            summary: {
                total: allScoredCount,
                hot: hotCount,
                warm: warmCount,
                cold: coldCount,
            },
            items: results,
        });
    } catch (err) {
        console.error("[lead-scoring.GET]", err);
        return jsonError(500, "INTERNAL_ERROR", "Lỗi khi tính điểm lead");
    }
}
