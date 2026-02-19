/**
 * GET /api/events — Server-Sent Events endpoint
 *
 * Pushes real-time events to admin/manager dashboard clients:
 *   - lead:new — new lead created
 *   - payment:new — new receipt/payment
 *   - kpi:update — KPI metrics changed
 *   - notification:new — new notification
 *
 * Supports Last-Event-ID for reconnection.
 * Requires authentication (admin/telesales/direct_page).
 */
import { subscribe, unsubscribe, type SSEEvent } from "@/lib/sse-bus";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
    // ─── Auth check (extract from cookie) ─────────────────────────
    const cookie = req.headers.get("cookie") || "";
    const tokenMatch = cookie.match(/access_token=([^;]+)/);
    if (!tokenMatch) {
        return new Response("Unauthorized", { status: 401 });
    }

    // Decode JWT payload (lightweight check, full auth in API routes)
    try {
        const parts = tokenMatch[1].split(".");
        if (parts.length < 2) throw new Error("Invalid JWT");
        const payload = JSON.parse(
            Buffer.from(parts[1].replace(/-/g, "+").replace(/_/g, "/"), "base64").toString()
        );
        const nowSec = Math.floor(Date.now() / 1000);
        if (!payload.exp || payload.exp <= nowSec) {
            return new Response("Token expired", { status: 401 });
        }
    } catch {
        return new Response("Invalid token", { status: 401 });
    }

    // ─── Last-Event-ID for reconnection ───────────────────────────
    const lastEventId = req.headers.get("Last-Event-ID");

    // ─── SSE stream ───────────────────────────────────────────────
    const encoder = new TextEncoder();
    let isClosed = false;

    const stream = new ReadableStream({
        start(controller) {
            // Send initial connection event
            controller.enqueue(
                encoder.encode(
                    `event: connected\ndata: ${JSON.stringify({ time: new Date().toISOString(), lastEventId })}\n\n`
                )
            );

            // Keep-alive every 30s
            const keepAlive = setInterval(() => {
                if (isClosed) {
                    clearInterval(keepAlive);
                    return;
                }
                try {
                    controller.enqueue(encoder.encode(": keepalive\n\n"));
                } catch {
                    clearInterval(keepAlive);
                    isClosed = true;
                }
            }, 30_000);

            // Subscribe to events
            const listener = (event: SSEEvent) => {
                if (isClosed) return;

                // Skip events before Last-Event-ID
                if (lastEventId && Number(event.id) <= Number(lastEventId)) return;

                try {
                    controller.enqueue(
                        encoder.encode(
                            `id: ${event.id}\nevent: ${event.type}\ndata: ${JSON.stringify(event.data)}\n\n`
                        )
                    );
                } catch {
                    isClosed = true;
                    clearInterval(keepAlive);
                    unsubscribe(listener);
                }
            };

            subscribe(listener);

            // Cleanup on close
            req.signal.addEventListener("abort", () => {
                isClosed = true;
                clearInterval(keepAlive);
                unsubscribe(listener);
                try { controller.close(); } catch { /* already closed */ }
            });
        },
    });

    return new Response(stream, {
        status: 200,
        headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache, no-transform",
            Connection: "keep-alive",
            "X-Accel-Buffering": "no", // nginx: disable buffering
        },
    });
}
