import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRouteAuth } from "@/lib/route-auth";
import { requireAdminRole } from "@/lib/admin-auth";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: Request, ctx: Ctx) {
    const { error, auth } = requireRouteAuth(req);
    if (error) return error;
    const forbidden = requireAdminRole(auth.role);
    if (forbidden) return forbidden;

    const { id } = await ctx.params;
    const students = await prisma.student.findMany({
        where: { instructorId: id },
        orderBy: { createdAt: "desc" },
        include: { lead: { select: { fullName: true, phone: true, status: true } }, course: { select: { code: true } } },
    });

    return NextResponse.json({
        items: students.map((s) => ({
            id: s.id,
            fullName: s.lead.fullName,
            phone: s.lead.phone,
            leadStatus: s.lead.status,
            studyStatus: s.studyStatus,
            courseCode: s.course?.code || null,
            createdAt: s.createdAt,
        })),
    });
}
