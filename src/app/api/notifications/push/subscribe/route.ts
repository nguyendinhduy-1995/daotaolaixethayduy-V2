/**
 * POST /api/notifications/push/subscribe
 *   Body: { endpoint, keys: { p256dh, auth } }
 *   Saves Web Push subscription for the authenticated user.
 *
 * DELETE /api/notifications/push/subscribe
 *   Body: { endpoint }
 *   Removes push subscription.
 *
 * Env: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireMappedRoutePermissionAuth } from "@/lib/route-auth";
import { jsonError } from "@/lib/api-response";

export async function POST(req: Request) {
    const authResult = await requireMappedRoutePermissionAuth(req);
    if (authResult.error) return authResult.error;

    const userId = authResult.auth.sub;

    let body: { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
    try {
        body = await req.json();
    } catch {
        return jsonError(400, "INVALID_BODY", "Invalid JSON body");
    }

    const { endpoint, keys } = body;
    if (!endpoint || !keys?.p256dh || !keys?.auth) {
        return jsonError(400, "MISSING_FIELDS", "endpoint, keys.p256dh, keys.auth are required");
    }

    try {
        // Upsert push subscription
        await prisma.pushSubscription.upsert({
            where: { endpoint },
            create: {
                userId,
                endpoint,
                p256dh: keys.p256dh,
                auth: keys.auth,
                createdAt: new Date(),
            },
            update: {
                userId,
                p256dh: keys.p256dh,
                auth: keys.auth,
                updatedAt: new Date(),
            },
        });

        return NextResponse.json({
            ok: true,
            message: "Push subscription saved",
        });
    } catch (err) {
        console.error("[push/subscribe]", err);
        return jsonError(500, "INTERNAL_ERROR", "Failed to save subscription");
    }
}

export async function DELETE(req: Request) {
    const authResult = await requireMappedRoutePermissionAuth(req);
    if (authResult.error) return authResult.error;

    let body: { endpoint?: string };
    try {
        body = await req.json();
    } catch {
        return jsonError(400, "INVALID_BODY", "Invalid JSON body");
    }

    if (!body.endpoint) {
        return jsonError(400, "MISSING_FIELDS", "endpoint is required");
    }

    try {
        await prisma.pushSubscription.deleteMany({
            where: { endpoint: body.endpoint },
        });

        return NextResponse.json({
            ok: true,
            message: "Push subscription removed",
        });
    } catch (err) {
        console.error("[push/unsubscribe]", err);
        return jsonError(500, "INTERNAL_ERROR", "Failed to remove subscription");
    }
}
