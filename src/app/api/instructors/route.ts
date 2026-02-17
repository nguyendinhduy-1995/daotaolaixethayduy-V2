import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError } from "@/lib/api-response";
import { requireRouteAuth } from "@/lib/route-auth";
import { requireAdminRole } from "@/lib/admin-auth";

export async function GET(req: Request) {
    const { error, auth } = requireRouteAuth(req);
    if (error) return error;
    const forbidden = requireAdminRole(auth.role);
    if (forbidden) return forbidden;

    const url = new URL(req.url);
    const status = url.searchParams.get("status")?.trim() || undefined;
    const q = url.searchParams.get("q")?.trim() || undefined;
    const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(url.searchParams.get("pageSize")) || 20));

    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (q) where.name = { contains: q, mode: "insensitive" };

    const [items, total] = await Promise.all([
        prisma.instructor.findMany({
            where,
            orderBy: { createdAt: "desc" },
            skip: (page - 1) * pageSize,
            take: pageSize,
            include: { _count: { select: { students: true, practicalLessons: true } } },
        }),
        prisma.instructor.count({ where }),
    ]);

    return NextResponse.json({
        items: items.map((i) => ({
            id: i.id,
            name: i.name,
            phone: i.phone,
            status: i.status,
            note: i.note,
            studentCount: i._count.students,
            lessonCount: i._count.practicalLessons,
            createdAt: i.createdAt,
        })),
        page,
        pageSize,
        total,
    });
}

export async function POST(req: Request) {
    const { error, auth } = requireRouteAuth(req);
    if (error) return error;
    const forbidden = requireAdminRole(auth.role);
    if (forbidden) return forbidden;

    const body = await req.json().catch(() => null);
    if (!body) return jsonError(400, "VALIDATION_ERROR", "Invalid JSON");

    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) return jsonError(400, "VALIDATION_ERROR", "Tên giáo viên là bắt buộc");

    const phone = typeof body.phone === "string" ? body.phone.trim() || null : null;
    const status = body.status === "INACTIVE" ? "INACTIVE" as const : "ACTIVE" as const;
    const note = typeof body.note === "string" ? body.note.trim() || null : null;

    if (phone) {
        const exists = await prisma.instructor.findUnique({ where: { phone } });
        if (exists) return jsonError(409, "CONFLICT", "SĐT giáo viên đã tồn tại");
    }

    const instructor = await prisma.instructor.create({
        data: { name, phone, status, note },
    });

    return NextResponse.json(instructor, { status: 201 });
}
