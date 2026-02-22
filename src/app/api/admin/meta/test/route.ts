import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireMappedRoutePermissionAuth } from "@/lib/route-auth";
import { requireAdminRole } from "@/lib/admin-auth";
import { createHash } from "crypto";

function sha256(input: string): string {
    return createHash("sha256").update(input).digest("hex");
}

export async function POST(req: Request) {
    const authResult = await requireMappedRoutePermissionAuth(req);
    if (authResult.error) return authResult.error;
    const adminError = requireAdminRole(authResult.auth.role);
    if (adminError) return adminError;

    const PIXEL_ID = process.env.META_PIXEL_ID;
    const ACCESS_TOKEN = process.env.META_CAPI_ACCESS_TOKEN;
    const TEST_EVENT_CODE = process.env.META_TEST_EVENT_CODE;

    if (!PIXEL_ID || !ACCESS_TOKEN) {
        return NextResponse.json({ ok: false, error: "META_PIXEL_ID or META_CAPI_ACCESS_TOKEN not configured" }, { status: 500 });
    }

    const eventId = `test-${Date.now()}`;
    const eventData = {
        event_name: "ViewContent",
        event_time: Math.floor(Date.now() / 1000),
        event_id: eventId,
        event_source_url: "https://thayduydaotaolaixe.com",
        action_source: "website",
        user_data: {
            client_ip_address: "127.0.0.1",
            client_user_agent: "TestEvent/Admin",
            em: [sha256("test@thayduy.com")],
        },
        custom_data: { content_name: "Admin Test Event" },
    };

    const graphPayload: Record<string, unknown> = { data: [eventData] };
    if (TEST_EVENT_CODE) graphPayload.test_event_code = TEST_EVENT_CODE;

    try {
        const graphUrl = `https://graph.facebook.com/v21.0/${PIXEL_ID}/events?access_token=${ACCESS_TOKEN}`;
        const metaRes = await fetch(graphUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(graphPayload),
        });

        const metaBody = await metaRes.json().catch(() => null) as Record<string, unknown> | null;
        const ok = metaRes.ok;
        const fbtraceId = (metaBody as { fbtrace_id?: string })?.fbtrace_id || null;

        await prisma.metaCapiLog.create({
            data: {
                eventName: "ViewContent",
                eventId,
                ok,
                fbtraceId,
                errorMsg: !ok ? JSON.stringify(metaBody).slice(0, 500) : null,
                ip: "127.0.0.1",
            },
        }).catch(() => undefined);

        return NextResponse.json({
            ok,
            fbtrace_id: fbtraceId,
            meta_response: metaBody,
            test_event_code: TEST_EVENT_CODE || null,
        });
    } catch (err) {
        console.error("[admin/meta/test]", err);
        return NextResponse.json({ ok: false, error: "Internal error" }, { status: 500 });
    }
}
