import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError } from "@/lib/api-response";
import { requireRouteAuth } from "@/lib/route-auth";
import { requireAdminRole } from "@/lib/admin-auth";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: Request, ctx: Ctx) {
    const { error, auth } = requireRouteAuth(req);
    if (error) return error;
    const forbidden = requireAdminRole(auth.role);
    if (forbidden) return forbidden;

    try {
        const { id: studentId } = await ctx.params;
        const plan = await prisma.studentExamPlan.findUnique({ where: { studentId } });
        return NextResponse.json(plan || { studentId, estimatedGraduationAt: null, estimatedExamAt: null, note: null });
    } catch (err) {
        console.error("[exam-plan.GET]", err);
        return jsonError(500, "INTERNAL_ERROR", "Lỗi khi tải kế hoạch thi");
    }
}

export async function PUT(req: Request, ctx: Ctx) {
    const { error, auth } = requireRouteAuth(req);
    if (error) return error;
    const forbidden = requireAdminRole(auth.role);
    if (forbidden) return forbidden;

    try {
        const { id: studentId } = await ctx.params;
        const body = await req.json().catch(() => null);
        if (!body) return jsonError(400, "VALIDATION_ERROR", "Invalid JSON");

        const student = await prisma.student.findUnique({ where: { id: studentId } });
        if (!student) return jsonError(404, "NOT_FOUND", "Không tìm thấy học viên");

        const data: {
            estimatedGraduationAt?: Date | null;
            estimatedExamAt?: Date | null;
            note?: string | null;
            updatedByUserId?: string;
        } = {};

        if (typeof body.estimatedGraduationAt === "string") {
            data.estimatedGraduationAt = body.estimatedGraduationAt ? new Date(body.estimatedGraduationAt) : null;
        }
        if (typeof body.estimatedExamAt === "string") {
            data.estimatedExamAt = body.estimatedExamAt ? new Date(body.estimatedExamAt) : null;
        }
        if (typeof body.note === "string") data.note = body.note.trim() || null;
        data.updatedByUserId = auth.sub;

        const plan = await prisma.studentExamPlan.upsert({
            where: { studentId },
            create: { studentId, ...data },
            update: data,
        });

        return NextResponse.json(plan);
    } catch (err) {
        console.error("[exam-plan.PUT]", err);
        return jsonError(500, "INTERNAL_ERROR", "Lỗi khi cập nhật kế hoạch thi");
    }
}
