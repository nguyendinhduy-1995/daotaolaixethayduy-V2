import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError } from "@/lib/api-response";
import { API_ERROR_VI } from "@/lib/api-error-vi";
import { requirePermissionRouteAuth } from "@/lib/route-auth";

/**
 * POST /api/admin/users/bulk-toggle
 *
 * Bulk activate/deactivate users.
 * Body: { userIds: string[], isActive: boolean }
 */
export async function POST(req: Request) {
    const authResult = await requirePermissionRouteAuth(req, { module: "admin_users", action: "UPDATE" });
    if (authResult.error) return authResult.error;

    try {
        const body = await req.json().catch(() => null);
        if (!body || typeof body !== "object") {
            return jsonError(400, "VALIDATION_ERROR", API_ERROR_VI.required);
        }

        const { userIds, isActive } = body as { userIds: unknown; isActive: unknown };
        if (!Array.isArray(userIds) || userIds.length === 0 || userIds.length > 50) {
            return jsonError(400, "VALIDATION_ERROR", "userIds phải là mảng 1-50 phần tử");
        }
        if (typeof isActive !== "boolean") {
            return jsonError(400, "VALIDATION_ERROR", "isActive phải là boolean");
        }

        // Prevent admin from deactivating themselves
        if (!isActive && userIds.includes(authResult.auth.sub)) {
            return jsonError(400, "VALIDATION_ERROR", "Không thể vô hiệu hóa chính mình");
        }

        const result = await prisma.user.updateMany({
            where: { id: { in: userIds as string[] } },
            data: { isActive, updatedAt: new Date() },
        });

        return NextResponse.json({ updated: result.count });
    } catch (err) {
    console.error("[admin.users.bulk-toggle]", err);
        return jsonError(500, "INTERNAL_ERROR", API_ERROR_VI.internal);
    }
}
