import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireMappedRoutePermissionAuth } from "@/lib/route-auth";
import { requireAdminRole } from "@/lib/admin-auth";

export async function GET(req: Request) {
    const authResult = await requireMappedRoutePermissionAuth(req);
    if (authResult.error) return authResult.error;
    const adminError = requireAdminRole(authResult.auth.role);
    if (adminError) return adminError;

    const url = new URL(req.url);
    const date = url.searchParams.get("date") || new Date().toISOString().slice(0, 10);
    const range = parseInt(url.searchParams.get("range") || "1");
    const siteFilter = url.searchParams.get("site");

    const dayEnd = new Date(`${date}T23:59:59.999+07:00`);
    const dayStart = range > 1
        ? (() => { const d = new Date(`${date}T00:00:00+07:00`); d.setDate(d.getDate() - range + 1); return d; })()
        : new Date(`${date}T00:00:00+07:00`);

    const baseWhere = siteFilter
        ? { createdAt: { gte: dayStart, lte: dayEnd }, site: siteFilter }
        : { createdAt: { gte: dayStart, lte: dayEnd } };

    try {
        const events = await prisma.siteAnalyticsEvent.findMany({
            where: baseWhere,
            select: {
                id: true, site: true, sessionId: true, eventType: true, page: true,
                referrer: true, userAgent: true, screenWidth: true, duration: true,
                ip: true, payload: true, createdAt: true,
            },
            orderBy: { createdAt: "asc" },
        });

        // Build CSV
        const headers = ["id", "site", "sessionId", "eventType", "page", "referrer", "userAgent", "screenWidth", "duration", "ip", "payload", "createdAt"];
        const csvRows = [headers.join(",")];

        for (const e of events) {
            csvRows.push([
                e.id,
                e.site,
                e.sessionId,
                e.eventType,
                `"${(e.page || "").replace(/"/g, '""')}"`,
                `"${(e.referrer || "").replace(/"/g, '""')}"`,
                `"${(e.userAgent || "").replace(/"/g, '""')}"`,
                e.screenWidth || "",
                e.duration || "",
                e.ip || "",
                `"${JSON.stringify(e.payload || {}).replace(/"/g, '""')}"`,
                e.createdAt.toISOString(),
            ].join(","));
        }

        const csv = csvRows.join("\n");

        return new NextResponse(csv, {
            headers: {
                "Content-Type": "text/csv; charset=utf-8",
                "Content-Disposition": `attachment; filename="analytics-${date}-${range}d.csv"`,
            },
        });
    } catch (err) {
        console.error("[analytics/export.GET]", err);
        return NextResponse.json({ error: "Internal error" }, { status: 500 });
    }
}
