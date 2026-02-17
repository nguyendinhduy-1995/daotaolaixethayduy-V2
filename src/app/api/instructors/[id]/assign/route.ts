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

    const { id: instructorId } = await ctx.params;
    const body = await req.json().catch(() => null);
    if (!body) return jsonError(400, "VALIDATION_ERROR", "Invalid JSON");

    const studentId = typeof body.studentId === "string" ? body.studentId.trim() : "";
    const reason = typeof body.reason === "string" ? body.reason.trim() : undefined;
    if (!studentId) return jsonError(400, "VALIDATION_ERROR", "Thiếu studentId");

    const instructor = await prisma.instructor.findUnique({ where: { id: instructorId } });
    if (!instructor) return jsonError(404, "NOT_FOUND", "Không tìm thấy giáo viên");
    if (instructor.status === "INACTIVE") return jsonError(400, "VALIDATION_ERROR", "Giáo viên đã ngừng hoạt động");

    const student = await prisma.student.findUnique({ where: { id: studentId }, include: { lead: true } });
    if (!student) return jsonError(404, "NOT_FOUND", "Không tìm thấy học viên");

    const oldInstructorId = student.instructorId;

    await prisma.$transaction(async (tx) => {
        await tx.student.update({ where: { id: studentId }, data: { instructorId } });
        await logInstructorChange(
            { leadId: student.leadId, fromInstructorId: oldInstructorId, toInstructorId: instructorId, reason, createdById: auth.sub },
            tx,
        );
    });

    return NextResponse.json({ ok: true, studentId, instructorId });
}
