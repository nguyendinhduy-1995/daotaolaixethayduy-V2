import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError } from "@/lib/api-response";
import { requireRouteAuth } from "@/lib/route-auth";

/**
 * GET /api/leads/province-staff-summary?date=YYYY-MM-DD
 * Returns province-level lead counts and per-staff lead/call breakdown for dashboard.
 */
export async function GET(req: Request) {
    const authResult = await requireRouteAuth(req);
    if (authResult.error) return authResult.error;

    const url = new URL(req.url);
    const date = url.searchParams.get("date") || new Date().toISOString().slice(0, 10);

    const dayStart = new Date(`${date}T00:00:00+07:00`);
    const dayEnd = new Date(`${date}T23:59:59.999+07:00`);

    try {
        // 1. Leads by province (today)
        const leadsByProvince = await prisma.lead.groupBy({
            by: ["province"],
            where: {
                createdAt: { gte: dayStart, lte: dayEnd },
            },
            _count: { id: true },
            orderBy: { _count: { id: "desc" } },
        });

        const provinceBreakdown = leadsByProvince.map((row) => ({
            province: row.province || "Chưa rõ",
            count: row._count.id,
        }));

        // 2. Per-staff breakdown: leads owned, leads called (status != NEW/HAS_PHONE = likely contacted)
        const staffUsers = await prisma.user.findMany({
            where: { isActive: true, role: { in: ["telesales", "manager"] } },
            select: { id: true, name: true, role: true, branchId: true },
        });

        const branches = await prisma.branch.findMany({
            where: { isActive: true },
            select: { id: true, name: true },
        });
        const branchMap = Object.fromEntries(branches.map((b) => [b.id, b.name]));

        const staffBreakdown = await Promise.all(
            staffUsers.map(async (staff) => {
                // Total leads owned
                const totalOwned = await prisma.lead.count({
                    where: { ownerId: staff.id },
                });

                // Leads received today
                const receivedToday = await prisma.lead.count({
                    where: {
                        ownerId: staff.id,
                        createdAt: { gte: dayStart, lte: dayEnd },
                    },
                });

                // Leads contacted today (has events today with type CALLED or status changes)
                const calledToday = await prisma.leadEvent.count({
                    where: {
                        createdById: staff.id,
                        type: { in: ["CALLED", "APPOINTED", "ARRIVED", "SIGNED", "OTHER"] },
                        createdAt: { gte: dayStart, lte: dayEnd },
                    },
                });

                // Leads with status beyond HAS_PHONE (appointed, arrived, signed) — shows work quality
                const progressedToday = await prisma.lead.count({
                    where: {
                        ownerId: staff.id,
                        status: { in: ["APPOINTED", "ARRIVED", "SIGNED"] },
                        updatedAt: { gte: dayStart, lte: dayEnd },
                    },
                });

                return {
                    id: staff.id,
                    name: staff.name,
                    role: staff.role,
                    branch: branchMap[staff.branchId] ?? "—",
                    totalOwned,
                    receivedToday,
                    calledToday,
                    progressedToday,
                };
            })
        );

        // Sort by calledToday desc
        staffBreakdown.sort((a, b) => b.calledToday - a.calledToday);

        // 3. Branch summary
        const branchSummary = await Promise.all(
            branches.map(async (branch) => {
                const totalLeads = await prisma.lead.count({
                    where: { branchId: branch.id },
                });
                const todayLeads = await prisma.lead.count({
                    where: {
                        branchId: branch.id,
                        createdAt: { gte: dayStart, lte: dayEnd },
                    },
                });
                return {
                    id: branch.id,
                    name: branch.name,
                    totalLeads,
                    todayLeads,
                };
            })
        );

        return NextResponse.json({
            date,
            provinceBreakdown,
            staffBreakdown,
            branchSummary,
        });
    } catch (err) {
        console.error("[leads/province-staff-summary]", err);
        return jsonError(500, "INTERNAL_ERROR", "Lỗi hệ thống");
    }
}
