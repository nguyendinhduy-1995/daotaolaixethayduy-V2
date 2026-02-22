import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError } from "@/lib/api-response";
import { requireRouteAuth } from "@/lib/route-auth";
import { requireAdminRole } from "@/lib/admin-auth";
import { logInstructorChange } from "@/lib/instructor-events";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx) {
    const { error, auth } = requireRouteAuth(req);
    if (error) return error;
    const forbidden = requireAdminRole(auth.role);
    if (forbidden) return forbidden;

    try {
        const { id: studentId } = await ctx.params;
        const body = await req.json().catch(() => null);
        if (!body) return jsonError(400, "VALIDATION_ERROR", "Invalid JSON");

        const newInstructorId = typeof body.instructorId === "string" ? body.instructorId.trim() || null : null;
        const reason = typeof body.reason === "string" ? body.reason.trim() : undefined;

        const student = await prisma.student.findUnique({ where: { id: studentId }, include: { lead: true } });
        if (!student) return jsonError(404, "NOT_FOUND", "Không tìm thấy học viên");

        if (newInstructorId) {
            const newInstructor = await prisma.instructor.findUnique({ where: { id: newInstructorId } });
            if (!newInstructor) return jsonError(404, "NOT_FOUND", "Không tìm thấy giáo viên");
            if (newInstructor.status === "INACTIVE") return jsonError(400, "VALIDATION_ERROR", "Giáo viên đã ngừng hoạt động");
        }

        const oldInstructorId = student.instructorId;

        await prisma.$transaction(async (tx) => {
            await tx.student.update({ where: { id: studentId }, data: { instructorId: newInstructorId } });
            await logInstructorChange(
                { leadId: student.leadId, fromInstructorId: oldInstructorId, toInstructorId: newInstructorId, reason, createdById: auth.sub },
                tx,
            );
        });

        return NextResponse.json({ ok: true, studentId, instructorId: newInstructorId });
    } catch (err) {
        console.error("[change-instructor.POST]", err);
        return jsonError(500, "INTERNAL_ERROR", "Lỗi khi chuyển giáo viên");
    }
}
