import type { Prisma, LeadStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { jsonError } from "@/lib/api-response";
import { API_ERROR_VI } from "@/lib/api-error-vi";
import { isLeadStatusType } from "@/lib/lead-events";
import { requirePermissionRouteAuth } from "@/lib/route-auth";
import { applyScopeToWhere, resolveScope } from "@/lib/scope";
import { toCsv, csvResponse, type CsvColumn } from "@/lib/utils/csv";

type LeadRow = Record<string, unknown> & {
    fullName: string | null;
    phone: string | null;
    status: string;
    source: string | null;
    channel: string | null;
    licenseType: string | null;
    createdAt: Date;
    owner: { name: string | null; email: string } | null;
};

const LEAD_CSV_COLUMNS: CsvColumn<LeadRow>[] = [
    { key: "fullName", label: "Họ tên" },
    { key: "phone", label: "Số điện thoại" },
    { key: "status", label: "Trạng thái" },
    { key: "source", label: "Nguồn" },
    { key: "channel", label: "Kênh" },
    { key: "licenseType", label: "Loại bằng" },
    { key: (row) => row.owner?.name ?? "", label: "Người phụ trách" },
    { key: (row) => row.owner?.email ?? "", label: "Email phụ trách" },
    { key: "createdAt", label: "Ngày tạo" },
];

export async function GET(req: Request) {
    const authResult = await requirePermissionRouteAuth(req, { module: "leads", action: "VIEW" });
    if (authResult.error) return authResult.error;
    const auth = authResult.auth;

    try {
        const { searchParams } = new URL(req.url);
        const status = searchParams.get("status");
        const createdFrom = searchParams.get("createdFrom");
        const createdTo = searchParams.get("createdTo");
        const ownerId = searchParams.get("ownerId");

        if (status && !isLeadStatusType(status)) {
            return jsonError(400, "VALIDATION_ERROR", API_ERROR_VI.required);
        }

        const createdAtFilter: Prisma.DateTimeFilter = {};
        if (createdFrom && /^\d{4}-\d{2}-\d{2}$/.test(createdFrom)) {
            createdAtFilter.gte = new Date(`${createdFrom}T00:00:00.000Z`);
        }
        if (createdTo && /^\d{4}-\d{2}-\d{2}$/.test(createdTo)) {
            createdAtFilter.lte = new Date(`${createdTo}T23:59:59.999Z`);
        }

        const scope = await resolveScope(auth);
        const whereBase: Prisma.LeadWhereInput = {
            ...(status ? { status: status as LeadStatus } : {}),
            ...(ownerId ? { ownerId } : {}),
            ...(createdFrom || createdTo ? { createdAt: createdAtFilter } : {}),
        };
        const where = applyScopeToWhere(whereBase, scope, "lead");

        const items = await prisma.lead.findMany({
            where,
            orderBy: { createdAt: "desc" },
            take: 5000,
            include: {
                owner: { select: { name: true, email: true } },
            },
        });

        const csv = toCsv(items as LeadRow[], LEAD_CSV_COLUMNS);
        const dateStr = new Date().toISOString().slice(0, 10);
        return csvResponse(csv, `leads_${dateStr}.csv`);
    } catch (err) {
    console.error("[leads.export]", err);
        return jsonError(500, "INTERNAL_ERROR", API_ERROR_VI.internal);
    }
}
