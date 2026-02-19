/**
 * GET /api/reports/kpi/export?format=xlsx|csv&from=YYYY-MM-DD&to=YYYY-MM-DD
 *
 * Export KPI report as Excel (XLSX) or CSV.
 * Admin/manager only.
 *
 * Columns: Date, Branch, Owner, Leads, Calls, Appointments, Arrivals, Signups, Revenue, ConversionRate
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireMappedRoutePermissionAuth } from "@/lib/route-auth";
import { requireAdminRole } from "@/lib/admin-auth";
import { jsonError } from "@/lib/api-response";
import * as XLSX from "xlsx";

export async function GET(req: Request) {
    const authResult = await requireMappedRoutePermissionAuth(req);
    if (authResult.error) return authResult.error;
    const adminError = requireAdminRole(authResult.auth.role);
    if (adminError) return adminError;

    const { searchParams } = new URL(req.url);
    const format = searchParams.get("format") || "xlsx";
    const from = searchParams.get("from") || new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
    const to = searchParams.get("to") || new Date().toISOString().slice(0, 10);

    try {
        // ─── Fetch KPI data ─────────────────────────────────────────
        const fromDate = new Date(from + "T00:00:00+07:00");
        const toDate = new Date(to + "T23:59:59+07:00");

        // Get leads grouped by date + owner
        const leads = await prisma.lead.findMany({
            where: { createdAt: { gte: fromDate, lte: toDate } },
            select: {
                id: true,
                status: true,
                createdAt: true,
                ownerId: true,
                branchId: true,
                owner: { select: { name: true, email: true } },
                branch: { select: { name: true } },
            },
            orderBy: { createdAt: "asc" },
        });

        // Get receipts for revenue
        const receipts = await prisma.receipt.findMany({
            where: { createdAt: { gte: fromDate, lte: toDate } },
            select: { amount: true, createdAt: true },
        });

        // Get lead events for calls/appointments
        const events = await prisma.leadEvent.findMany({
            where: {
                createdAt: { gte: fromDate, lte: toDate },
                type: { in: ["CALLED", "APPOINTED", "ARRIVED", "SIGNED"] },
            },
            select: { type: true, createdAt: true },
        });

        // ─── Aggregate by date ──────────────────────────────────────
        const dateMap = new Map<string, {
            date: string;
            leads: number;
            calls: number;
            appointments: number;
            arrivals: number;
            signups: number;
            revenue: number;
        }>();

        // Initialize all dates in range
        const cursor = new Date(fromDate);
        while (cursor <= toDate) {
            const dateKey = cursor.toISOString().slice(0, 10);
            dateMap.set(dateKey, {
                date: dateKey,
                leads: 0,
                calls: 0,
                appointments: 0,
                arrivals: 0,
                signups: 0,
                revenue: 0,
            });
            cursor.setDate(cursor.getDate() + 1);
        }

        // Count leads per day
        for (const lead of leads) {
            const dateKey = lead.createdAt.toISOString().slice(0, 10);
            const row = dateMap.get(dateKey);
            if (row) row.leads++;
        }

        // Count events per day
        for (const event of events) {
            const dateKey = event.createdAt.toISOString().slice(0, 10);
            const row = dateMap.get(dateKey);
            if (!row) continue;
            switch (event.type) {
                case "CALLED": row.calls++; break;
                case "APPOINTED": row.appointments++; break;
                case "ARRIVED": row.arrivals++; break;
                case "SIGNED": row.signups++; break;
            }
        }

        // Sum revenue per day
        for (const receipt of receipts) {
            const dateKey = receipt.createdAt.toISOString().slice(0, 10);
            const row = dateMap.get(dateKey);
            if (row) row.revenue += Number(receipt.amount);
        }

        // Build rows
        const rows = Array.from(dateMap.values()).map((r) => ({
            "Ngày": r.date,
            "Leads mới": r.leads,
            "Cuộc gọi": r.calls,
            "Hẹn lịch": r.appointments,
            "Đến trung tâm": r.arrivals,
            "Ghi danh": r.signups,
            "Doanh thu (VND)": r.revenue,
            "Tỷ lệ chuyển đổi (%)": r.leads > 0 ? Math.round((r.signups / r.leads) * 100) : 0,
        }));

        // ─── Summary row ────────────────────────────────────────────
        const totals = rows.reduce(
            (acc, r) => ({
                leads: acc.leads + r["Leads mới"],
                calls: acc.calls + r["Cuộc gọi"],
                appointments: acc.appointments + r["Hẹn lịch"],
                arrivals: acc.arrivals + r["Đến trung tâm"],
                signups: acc.signups + r["Ghi danh"],
                revenue: acc.revenue + r["Doanh thu (VND)"],
            }),
            { leads: 0, calls: 0, appointments: 0, arrivals: 0, signups: 0, revenue: 0 }
        );

        rows.push({
            "Ngày": "TỔNG",
            "Leads mới": totals.leads,
            "Cuộc gọi": totals.calls,
            "Hẹn lịch": totals.appointments,
            "Đến trung tâm": totals.arrivals,
            "Ghi danh": totals.signups,
            "Doanh thu (VND)": totals.revenue,
            "Tỷ lệ chuyển đổi (%)": totals.leads > 0 ? Math.round((totals.signups / totals.leads) * 100) : 0,
        });

        // ─── Generate file ──────────────────────────────────────────
        const ws = XLSX.utils.json_to_sheet(rows);

        // Set column widths
        ws["!cols"] = [
            { wch: 12 }, { wch: 10 }, { wch: 10 }, { wch: 10 },
            { wch: 14 }, { wch: 10 }, { wch: 16 }, { wch: 20 },
        ];

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "KPI Report");

        const filename = `kpi-report-${from}-${to}`;

        if (format === "csv") {
            const csv = XLSX.utils.sheet_to_csv(ws);
            return new Response(csv, {
                status: 200,
                headers: {
                    "Content-Type": "text/csv; charset=utf-8",
                    "Content-Disposition": `attachment; filename="${filename}.csv"`,
                },
            });
        }

        // Default: XLSX
        const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
        return new Response(buf, {
            status: 200,
            headers: {
                "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                "Content-Disposition": `attachment; filename="${filename}.xlsx"`,
            },
        });
    } catch (err) {
        console.error("[reports/kpi/export]", err);
        return jsonError(500, "INTERNAL_ERROR", "Failed to generate report");
    }
}
