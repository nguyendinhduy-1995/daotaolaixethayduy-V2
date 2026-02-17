import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError } from "@/lib/api-response";
import { API_ERROR_VI } from "@/lib/api-error-vi";
import { requirePermissionRouteAuth } from "@/lib/route-auth";

/**
 * POST /api/leads/bulk-assign
 *
 * Bulk assign owner to multiple leads at once.
 * Body: { leadIds: string[], ownerId: string }
 */
export async function POST(req: Request) {
    const authResult = await requirePermissionRouteAuth(req, { module: "leads", action: "ASSIGN" });
    if (authResult.error) return authResult.error;

    try {
        const body = await req.json().catch(() => null);
        if (!body || typeof body !== "object") {
            return jsonError(400, "VALIDATION_ERROR", API_ERROR_VI.required);
        }

        const { leadIds, ownerId } = body as { leadIds: unknown; ownerId: unknown };
        if (!Array.isArray(leadIds) || leadIds.length === 0 || leadIds.length > 100) {
            return jsonError(400, "VALIDATION_ERROR", "leadIds phải là mảng 1-100 phần tử");
        }
        if (typeof ownerId !== "string" || ownerId.trim().length === 0) {
            return jsonError(400, "VALIDATION_ERROR", "ownerId là bắt buộc");
        }

        // Verify owner exists and is active
        const owner = await prisma.user.findUnique({ where: { id: ownerId }, select: { id: true, isActive: true } });
        if (!owner || !owner.isActive) {
            return jsonError(400, "VALIDATION_ERROR", "Người phụ trách không tồn tại hoặc đã bị vô hiệu hóa");
        }

        const result = await prisma.lead.updateMany({
            where: { id: { in: leadIds as string[] } },
            data: { ownerId, updatedAt: new Date() },
        });

        return NextResponse.json({ updated: result.count });
    } catch (err) {
    console.error("[leads.bulk-assign]", err);
        return jsonError(500, "INTERNAL_ERROR", API_ERROR_VI.internal);
    }
}
