import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createHash } from "crypto";

const PIXEL_ID = process.env.META_PIXEL_ID;
const ACCESS_TOKEN = process.env.META_CAPI_ACCESS_TOKEN;
const TEST_EVENT_CODE = process.env.META_TEST_EVENT_CODE;

function sha256(input: string): string {
    return createHash("sha256").update(input).digest("hex");
}

function normalizePhone(phone: string): string {
    // Strip to digits, add 84 prefix if starts with 0
    const digits = phone.replace(/\D/g, "");
    if (digits.startsWith("0")) return "84" + digits.slice(1);
    if (digits.startsWith("84")) return digits;
    return digits;
}

function getCookieValue(req: Request, name: string): string | null {
    const cookie = req.headers.get("cookie");
    if (!cookie) return null;
    const match = cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
    return match ? decodeURIComponent(match[1]) : null;
}

type CapiInput = {
    event_name: string;
    event_id: string;
    event_source_url: string;
    email?: string;
    phone?: string;
    custom_data?: Record<string, unknown>;
};

export async function POST(req: Request) {
    if (!PIXEL_ID || !ACCESS_TOKEN) {
        return NextResponse.json({ ok: false, error: "Meta CAPI not configured" }, {
            status: 500,
            headers: { "Access-Control-Allow-Origin": "*" },
        });
    }

    try {
        const body = (await req.json()) as CapiInput;
        const { event_name, event_id, event_source_url, email, phone, custom_data } = body;

        if (!event_name || !event_id) {
            return NextResponse.json({ ok: false, error: "Missing event_name or event_id" }, {
                status: 400,
                headers: { "Access-Control-Allow-Origin": "*" },
            });
        }

        // Extract server-side data
        const forwarded = req.headers.get("x-forwarded-for");
        const clientIp = forwarded ? forwarded.split(",")[0].trim() : null;
        const clientUa = req.headers.get("user-agent") || null;
        const fbp = getCookieValue(req, "_fbp");
        const fbc = getCookieValue(req, "_fbc");

        // Build user_data with hashed PII
        const userData: Record<string, unknown> = {
            client_ip_address: clientIp,
            client_user_agent: clientUa,
        };
        if (fbp) userData.fbp = fbp;
        if (fbc) userData.fbc = fbc;
        if (email) userData.em = [sha256(email.trim().toLowerCase())];
        if (phone) userData.ph = [sha256(normalizePhone(phone))];

        // Build event payload
        const eventData: Record<string, unknown> = {
            event_name,
            event_time: Math.floor(Date.now() / 1000),
            event_id,
            event_source_url: event_source_url || "",
            action_source: "website",
            user_data: userData,
        };
        if (custom_data) eventData.custom_data = custom_data;

        const graphPayload: Record<string, unknown> = {
            data: [eventData],
        };
        if (TEST_EVENT_CODE) graphPayload.test_event_code = TEST_EVENT_CODE;

        // Send to Graph API
        const graphUrl = `https://graph.facebook.com/v21.0/${PIXEL_ID}/events?access_token=${ACCESS_TOKEN}`;
        const metaRes = await fetch(graphUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(graphPayload),
        });

        const metaBody = await metaRes.json().catch(() => null) as Record<string, unknown> | null;
        const ok = metaRes.ok;
        const fbtraceId = (metaBody as { fbtrace_id?: string })?.fbtrace_id || null;
        const errorMsg = !ok ? JSON.stringify(metaBody).slice(0, 500) : null;

        // Log to DB
        await prisma.metaCapiLog.create({
            data: {
                eventName: event_name,
                eventId: event_id,
                ok,
                fbtraceId,
                errorMsg,
                ip: clientIp,
            },
        }).catch((err: unknown) => console.error("[meta/capi] DB log error:", err));

        if (!ok) {
            console.error("[meta/capi] Meta API error:", metaBody);
            return NextResponse.json({ ok: false, error: errorMsg, fbtrace_id: fbtraceId }, {
                status: 502,
                headers: { "Access-Control-Allow-Origin": "*" },
            });
        }

        return NextResponse.json({ ok: true, fbtrace_id: fbtraceId }, {
            headers: { "Access-Control-Allow-Origin": "*" },
        });
    } catch (err) {
        console.error("[meta/capi] Error:", err);
        return NextResponse.json({ ok: false, error: "Internal error" }, {
            status: 500,
            headers: { "Access-Control-Allow-Origin": "*" },
        });
    }
}

// CORS preflight
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
