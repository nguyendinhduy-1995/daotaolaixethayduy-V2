import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const VALID_SITES = ["mophong", "taplai", "landing"];
const VALID_EVENT_TYPES = [
    // Common
    "page_view", "page_duration", "click", "scroll",
    "video_play", "video_pause", "video_ended",
    "session_end",
    // Mophong-specific
    "scenario_view", "scenario_brake", "scenario_score",
    "exam_start", "exam_finish",
    // Taplai-specific
    "topic_view", "question_answer", "daily_practice",
    "wrong_review", "weak_topic_view", "search_query",
    // Landing-specific
    "section_view", "cta_click", "phone_click", "zalo_click",
    "form_focus", "form_submit", "form_view", "pricing_view",
];

type AnalyticsEvent = {
    site: string;
    sessionId: string;
    eventType: string;
    page: string;
    referrer?: string | null;
    userAgent?: string | null;
    screenWidth?: number | null;
    duration?: number | null;
    payload?: Record<string, unknown> | null;
    ts?: string;
};

export async function POST(req: Request) {
    try {
        const body = (await req.json()) as
            | { events: AnalyticsEvent[] }
            | AnalyticsEvent;

        // Support single event or batch
        const events: AnalyticsEvent[] = Array.isArray((body as { events: AnalyticsEvent[] }).events)
            ? (body as { events: AnalyticsEvent[] }).events
            : [body as AnalyticsEvent];

        if (events.length === 0 || events.length > 50) {
            return NextResponse.json(
                { error: "Batch must contain 1-50 events" },
                { status: 400 }
            );
        }

        // Get client IP from headers
        const forwarded = req.headers.get("x-forwarded-for");
        const ip = forwarded ? forwarded.split(",")[0].trim() : null;

        // Validate & prepare records
        const records = [];

        for (const evt of events) {
            if (!evt.site || !VALID_SITES.includes(evt.site)) continue;
            if (!evt.sessionId || evt.sessionId.length > 100) continue;
            if (!evt.eventType || !VALID_EVENT_TYPES.includes(evt.eventType)) continue;
            if (!evt.page || evt.page.length > 500) continue;

            records.push({
                site: evt.site,
                sessionId: evt.sessionId,
                eventType: evt.eventType,
                page: evt.page.slice(0, 500),
                referrer: evt.referrer ? String(evt.referrer).slice(0, 1000) : null,
                userAgent: evt.userAgent ? String(evt.userAgent).slice(0, 500) : null,
                screenWidth: typeof evt.screenWidth === "number" ? evt.screenWidth : null,
                duration:
                    evt.eventType === "page_duration" || evt.eventType === "session_end"
                        ? typeof evt.payload === "object" &&
                            evt.payload &&
                            typeof (evt.payload as { duration?: number; totalDuration?: number }).duration === "number"
                            ? (evt.payload as { duration: number }).duration
                            : typeof (evt.payload as { totalDuration?: number })?.totalDuration === "number"
                                ? (evt.payload as { totalDuration: number }).totalDuration
                                : null
                        : null,
                payload: evt.payload ? (evt.payload as object) : undefined,
                ip,
            });
        }

        if (records.length > 0) {
            await prisma.siteAnalyticsEvent.createMany({ data: records });
        }

        return NextResponse.json({ ok: true, count: records.length }, {
            headers: { "Access-Control-Allow-Origin": "*" },
        });
    } catch (err) {
        console.error("[analytics.POST]", err);
        return NextResponse.json({ ok: false, error: "Internal error" }, {
            status: 500,
            headers: { "Access-Control-Allow-Origin": "*" },
        });
    }
}

// CORS headers for cross-origin tracker requests
export async function OPTIONS() {
    return new NextResponse(null, {
        status: 204,
        headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
            "Access-Control-Max-Age": "86400",
        },
    });
}
