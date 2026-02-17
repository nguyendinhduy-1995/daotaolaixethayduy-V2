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

    const { id } = await ctx.params;
    const instructor = await prisma.instructor.findUnique({
        where: { id },
        include: { _count: { select: { students: true, practicalLessons: true } } },
    });
    if (!instructor) return jsonError(404, "NOT_FOUND", "Không tìm thấy giáo viên");

    return NextResponse.json({
        ...instructor,
        studentCount: instructor._count.students,
        lessonCount: instructor._count.practicalLessons,
    });
}

export async function PATCH(req: Request, ctx: Ctx) {
    const { error, auth } = requireRouteAuth(req);
    if (error) return error;
    const forbidden = requireAdminRole(auth.role);
    if (forbidden) return forbidden;

    const { id } = await ctx.params;
    const existing = await prisma.instructor.findUnique({ where: { id } });
    if (!existing) return jsonError(404, "NOT_FOUND", "Không tìm thấy giáo viên");

    const body = await req.json().catch(() => null);
    if (!body) return jsonError(400, "VALIDATION_ERROR", "Invalid JSON");

    const data: Record<string, unknown> = {};
    if (typeof body.name === "string" && body.name.trim()) data.name = body.name.trim();
    if (typeof body.phone === "string") data.phone = body.phone.trim() || null;
    if (body.status === "ACTIVE" || body.status === "INACTIVE") data.status = body.status;
    if (typeof body.note === "string") data.note = body.note.trim() || null;

    if (data.phone && data.phone !== existing.phone) {
        const dup = await prisma.instructor.findUnique({ where: { phone: data.phone as string } });
        if (dup) return jsonError(409, "CONFLICT", "SĐT giáo viên đã tồn tại");
    }

    const updated = await prisma.instructor.update({ where: { id }, data });
    return NextResponse.json(updated);
}

export async function DELETE(req: Request, ctx: Ctx) {
    const { error, auth } = requireRouteAuth(req);
    if (error) return error;
    const forbidden = requireAdminRole(auth.role);
    if (forbidden) return forbidden;

    const { id } = await ctx.params;
    const existing = await prisma.instructor.findUnique({ where: { id } });
    if (!existing) return jsonError(404, "NOT_FOUND", "Không tìm thấy giáo viên");

    await prisma.instructor.update({ where: { id }, data: { status: "INACTIVE" } });
    return NextResponse.json({ ok: true });
}
