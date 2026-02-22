import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireMappedRoutePermissionAuth } from "@/lib/route-auth";
import { requireAdminRole } from "@/lib/admin-auth";

export async function GET(req: Request) {
    const authResult = await requireMappedRoutePermissionAuth(req);
    if (authResult.error) return authResult.error;
    const adminError = requireAdminRole(authResult.auth.role);
    if (adminError) return adminError;

    try {
        const logs = await prisma.metaCapiLog.findMany({
            orderBy: { createdAt: "desc" },
            take: 30,
        });
        return NextResponse.json({ logs });
    } catch (err) {
        console.error("[admin/meta/logs]", err);
        return NextResponse.json({ error: "Internal error" }, { status: 500 });
    }
}
