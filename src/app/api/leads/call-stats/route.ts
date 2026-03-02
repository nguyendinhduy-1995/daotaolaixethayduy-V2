import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError } from "@/lib/api-response";
import { requirePermissionRouteAuth } from "@/lib/route-auth";
import { resolveScope, applyScopeToWhere } from "@/lib/scope";

/**
 * GET /api/leads/call-stats
 * Returns call statistics for the current user (or all if admin).
 */
export async function GET(req: Request) {
    const authResult = await requirePermissionRouteAuth(req, { module: "leads", action: "VIEW" });
    if (authResult.error) return authResult.error;
    const auth = authResult.auth;

    try {
        const scope = await resolveScope(auth);
        const now = new Date();

        // Vietnam timezone: UTC+7
        const vnToday = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Ho_Chi_Minh" }));
        const startOfDay = new Date(vnToday);
        startOfDay.setHours(0, 0, 0, 0);
        const startOfDayUTC = new Date(startOfDay.getTime() - 7 * 60 * 60 * 1000);

        // Scope filter for leads
        const leadWhere = applyScopeToWhere({}, scope, "lead");

        // 1. Today's calls count
        const todayCalls = await prisma.leadEvent.count({
            where: {
                type: "CALLED",
                createdAt: { gte: startOfDayUTC },
                lead: leadWhere,
            },
        });

        // 2. Get outcome breakdown from today's event notes
        const todayEvents = await prisma.leadEvent.findMany({
            where: {
                type: "CALLED",
                createdAt: { gte: startOfDayUTC },
                lead: leadWhere,
            },
            select: { payload: true },
        });

        const outcomeCount: Record<string, number> = {};
        const outcomeLabels: Record<string, string> = {
            "Nghe máy": "answered",
            "Không nghe": "no_answer",
            "Máy bận": "busy",
            "Quan tâm": "interested",
            "Từ chối": "not_interested",
            "Sai số": "wrong_number",
            "Hẹn gọi lại": "call_back",
        };
        for (const ev of todayEvents) {
            const payload = ev.payload as Record<string, unknown> | null;
            const note = (payload?.note as string) || "";
            let matched = false;
            for (const [label, key] of Object.entries(outcomeLabels)) {
                if (note.startsWith(label)) {
                    outcomeCount[key] = (outcomeCount[key] || 0) + 1;
                    matched = true;
                    break;
                }
            }
            if (!matched) {
                outcomeCount["other"] = (outcomeCount["other"] || 0) + 1;
            }
        }

        // 3. Callback overdue count — use AND to combine scope + custom filter
        const callbackOverdue = await prisma.lead.count({
            where: {
                AND: [
                    leadWhere,
                    { callbackAt: { lte: now } },
                    { NOT: { status: { in: ["SIGNED", "STUDYING", "EXAMED", "RESULT", "LOST"] } } },
                ],
            },
        });

        // 4. Uncalled leads count
        const uncalledCount = await prisma.lead.count({
            where: {
                AND: [
                    leadWhere,
                    { events: { none: { type: "CALLED" } } },
                    { NOT: { status: { in: ["SIGNED", "STUDYING", "EXAMED", "RESULT", "LOST"] } } },
                ],
            },
        });

        // 5. Week calls (last 7 days)
        const weekStart = new Date(startOfDayUTC);
        weekStart.setDate(weekStart.getDate() - 6);
        const weekCalls: Record<string, number> = {};
        for (let i = 6; i >= 0; i--) {
            const d = new Date(startOfDayUTC);
            d.setDate(d.getDate() - i);
            weekCalls[d.toISOString().split("T")[0]] = 0;
        }
        const weekEventsDetail = await prisma.leadEvent.findMany({
            where: {
                type: "CALLED",
                createdAt: { gte: weekStart },
                lead: leadWhere,
            },
            select: { createdAt: true },
        });
        for (const ev of weekEventsDetail) {
            const vnDate = new Date(ev.createdAt.getTime() + 7 * 60 * 60 * 1000);
            const key = vnDate.toISOString().split("T")[0];
            if (key in weekCalls) weekCalls[key]++;
        }

        return NextResponse.json({
            todayCalls,
            todayOutcomes: outcomeCount,
            callbackOverdue,
            uncalledCount,
            weekCalls,
        });
    } catch (err) {
        console.error("[leads/call-stats]", err);
        return jsonError(500, "INTERNAL_ERROR", "Lỗi hệ thống");
    }
}
