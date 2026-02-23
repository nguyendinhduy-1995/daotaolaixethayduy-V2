import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError } from "@/lib/api-response";
import { requirePermissionRouteAuth } from "@/lib/route-auth";

/**
 * GET /api/admin/settings
 * List all feature settings
 */
export async function GET(req: Request) {
    const authResult = await requirePermissionRouteAuth(req, { module: "admin_automation_admin", action: "VIEW" });
    if (authResult.error) return authResult.error;

    try {
        const settings = await prisma.featureSetting.findMany({
            orderBy: { key: "asc" },
        });
        return NextResponse.json({ items: settings });
    } catch (err) {
        console.error("[admin/settings]", err);
        return jsonError(500, "INTERNAL_ERROR", "Lỗi hệ thống");
    }
}

/**
 * POST /api/admin/settings
 * Upsert a feature setting by key
 * Body: { key: string, enabled: boolean, config?: object }
 */
export async function POST(req: Request) {
    const authResult = await requirePermissionRouteAuth(req, { module: "admin_automation_admin", action: "UPDATE" });
    if (authResult.error) return authResult.error;

    try {
        const body = await req.json().catch(() => null);
        if (!body || typeof body !== "object" || typeof body.key !== "string") {
            return jsonError(400, "VALIDATION_ERROR", "Thiếu key");
        }

        const key = body.key.trim();
        const enabled = Boolean(body.enabled);
        const config = body.config !== undefined ? body.config : undefined;

        const setting = await prisma.featureSetting.upsert({
            where: { key },
            update: { enabled, ...(config !== undefined ? { config } : {}) },
            create: { key, enabled, config: config ?? null },
        });

        return NextResponse.json({ setting });
    } catch (err) {
        console.error("[admin/settings]", err);
        return jsonError(500, "INTERNAL_ERROR", "Lỗi hệ thống");
    }
}
