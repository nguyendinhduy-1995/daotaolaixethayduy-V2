import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError } from "@/lib/api-response";
import { requireMappedRoutePermissionAuth } from "@/lib/route-auth";
import { requireAdminRole } from "@/lib/admin-auth";

type RouteContext = { params: Promise<{ id: string }> | { id: string } };

const PLACEMENTS = ["HEAD", "BODY_TOP", "BODY_BOTTOM"] as const;
const MAX_CODE_LENGTH = 50_000;

function isPlacement(v: unknown): v is (typeof PLACEMENTS)[number] {
    return typeof v === "string" && (PLACEMENTS as readonly string[]).includes(v);
}

export async function PATCH(req: Request, context: RouteContext) {
    const authResult = await requireMappedRoutePermissionAuth(req);
    if (authResult.error) return authResult.error;
    const adminError = requireAdminRole(authResult.auth.role);
    if (adminError) return adminError;

    try {
        const { id } = await Promise.resolve(context.params);
        const body = await req.json().catch(() => null);
        if (!body || typeof body !== "object") {
            return jsonError(400, "VALIDATION_ERROR", "Invalid JSON body");
        }

        const { name, placement, code, isEnabled } = body as Record<string, unknown>;

        if (placement !== undefined && !isPlacement(placement)) {
            return jsonError(400, "VALIDATION_ERROR", "placement phải là HEAD, BODY_TOP hoặc BODY_BOTTOM");
        }
        if (code !== undefined && typeof code === "string" && code.length > MAX_CODE_LENGTH) {
            return jsonError(400, "VALIDATION_ERROR", `code không được vượt quá ${MAX_CODE_LENGTH} ký tự`);
        }

        const item = await prisma.trackingCode.update({
            where: { id },
            data: {
                ...(name !== undefined ? { name: String(name).trim() } : {}),
                ...(placement !== undefined ? { placement } : {}),
                ...(code !== undefined ? { code: String(code) } : {}),
                ...(isEnabled !== undefined ? { isEnabled: Boolean(isEnabled) } : {}),
                updatedById: authResult.auth.sub,
            },
        });

        console.info(
            `[AUDIT] TrackingCode UPDATED id=${item.id} site=${item.site} key=${item.key} by=${authResult.auth.sub} at=${new Date().toISOString()}`
        );

        return NextResponse.json({ item });
    } catch (err) {
        console.error("[admin.tracking-codes.[id].PATCH]", err);
        return jsonError(500, "INTERNAL_ERROR", "Internal server error");
    }
}

export async function DELETE(req: Request, context: RouteContext) {
    const authResult = await requireMappedRoutePermissionAuth(req);
    if (authResult.error) return authResult.error;
    const adminError = requireAdminRole(authResult.auth.role);
    if (adminError) return adminError;

    try {
        const { id } = await Promise.resolve(context.params);
        const item = await prisma.trackingCode.delete({ where: { id } });

        console.info(
            `[AUDIT] TrackingCode DELETED id=${item.id} site=${item.site} key=${item.key} by=${authResult.auth.sub} at=${new Date().toISOString()}`
        );

        return NextResponse.json({ ok: true });
    } catch (err) {
        console.error("[admin.tracking-codes.[id].DELETE]", err);
        return jsonError(500, "INTERNAL_ERROR", "Internal server error");
    }
}
