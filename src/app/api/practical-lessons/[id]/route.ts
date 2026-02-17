import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError } from "@/lib/api-response";
import { requireRouteAuth } from "@/lib/route-auth";
import { requireAdminRole } from "@/lib/admin-auth";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, ctx: Ctx) {
    const { error, auth } = requireRouteAuth(req);
    if (error) return error;
    const forbidden = requireAdminRole(auth.role);
    if (forbidden) return forbidden;

    const { id } = await ctx.params;
    const existing = await prisma.practicalLesson.findUnique({ where: { id } });
    if (!existing) return jsonError(404, "NOT_FOUND", "Không tìm thấy buổi học");

    const body = await req.json().catch(() => null);
    if (!body) return jsonError(400, "VALIDATION_ERROR", "Invalid JSON");

    const data: Record<string, unknown> = {};
    if (typeof body.location === "string") data.location = body.location.trim() || null;
    if (typeof body.note === "string") data.note = body.note.trim() || null;
    if (body.status && ["SCHEDULED", "DONE", "CANCELED", "NO_SHOW"].includes(body.status)) data.status = body.status;
    if (typeof body.startAt === "string") data.startAt = new Date(body.startAt);
    if (typeof body.endAt === "string") data.endAt = new Date(body.endAt);
    if (body.lessonType && ["SA_HINH", "DUONG_TRUONG", "DAT", "CABIN", "OTHER"].includes(body.lessonType)) data.lessonType = body.lessonType;

    const updated = await prisma.practicalLesson.update({ where: { id }, data });
    return NextResponse.json(updated);
}

export async function DELETE(req: Request, ctx: Ctx) {
    const { error, auth } = requireRouteAuth(req);
    if (error) return error;
    const forbidden = requireAdminRole(auth.role);
    if (forbidden) return forbidden;

    const { id } = await ctx.params;
    const existing = await prisma.practicalLesson.findUnique({ where: { id } });
    if (!existing) return jsonError(404, "NOT_FOUND", "Không tìm thấy buổi học");

    await prisma.practicalLesson.update({ where: { id }, data: { status: "CANCELED" } });
    return NextResponse.json({ ok: true });
}
