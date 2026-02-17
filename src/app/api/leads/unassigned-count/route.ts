import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError } from "@/lib/api-response";
import { API_ERROR_VI } from "@/lib/api-error-vi";
import { requirePermissionRouteAuth } from "@/lib/route-auth";
import { applyScopeToWhere, resolveScope } from "@/lib/scope";
import type { Prisma } from "@prisma/client";

export async function GET(req: Request) {
    const authResult = await requirePermissionRouteAuth(req, { module: "leads", action: "VIEW" });
    if (authResult.error) return authResult.error;
    const auth = authResult.auth;

    try {
        const { searchParams } = new URL(req.url);
        const dateRaw = searchParams.get("date");
        if (!dateRaw || !/^\d{4}-\d{2}-\d{2}$/.test(dateRaw)) {
            return jsonError(400, "VALIDATION_ERROR", API_ERROR_VI.required);
        }

        const gte = new Date(`${dateRaw}T00:00:00.000Z`);
        const lte = new Date(`${dateRaw}T23:59:59.999Z`);

        const scope = await resolveScope(auth);
        const whereBase: Prisma.LeadWhereInput = {
            ownerId: null,
            createdAt: { gte, lte },
        };
        const where = applyScopeToWhere(whereBase, scope, "lead");

        const count = await prisma.lead.count({ where });
        return NextResponse.json({ count });
    } catch (err) {
    console.error("[leads.unassigned-count]", err);
        return jsonError(500, "INTERNAL_ERROR", API_ERROR_VI.internal);
    }
}
