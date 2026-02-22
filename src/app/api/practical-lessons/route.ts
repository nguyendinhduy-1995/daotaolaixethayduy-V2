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

    try {
        const url = new URL(req.url);
        const instructorId = url.searchParams.get("instructorId")?.trim() || undefined;
        const studentId = url.searchParams.get("studentId")?.trim() || undefined;
        const status = url.searchParams.get("status")?.trim() || undefined;
        const from = url.searchParams.get("from")?.trim() || undefined;
        const to = url.searchParams.get("to")?.trim() || undefined;
        const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
        const pageSize = Math.min(100, Math.max(1, Number(url.searchParams.get("pageSize")) || 20));

        const where: Record<string, unknown> = {};
        if (instructorId) where.instructorId = instructorId;
        if (studentId) where.studentId = studentId;
        if (status) where.status = status;
        if (from || to) {
            const startAt: Record<string, Date> = {};
            if (from) startAt.gte = new Date(from);
            if (to) startAt.lte = new Date(to + "T23:59:59.999Z");
            where.startAt = startAt;
        }

        const [items, total] = await Promise.all([
            prisma.practicalLesson.findMany({
                where,
                orderBy: { startAt: "asc" },
                skip: (page - 1) * pageSize,
                take: pageSize,
                include: {
                    student: { include: { lead: { select: { fullName: true, phone: true } } } },
                    instructor: { select: { id: true, name: true, phone: true } },
                },
            }),
            prisma.practicalLesson.count({ where }),
        ]);

        return NextResponse.json({
            items: items.map((l) => ({
                id: l.id,
                studentId: l.studentId,
                studentName: l.student.lead.fullName,
                studentPhone: l.student.lead.phone,
                instructorId: l.instructorId,
                instructorName: l.instructor.name,
                startAt: l.startAt,
                endAt: l.endAt,
                location: l.location,
                lessonType: l.lessonType,
                status: l.status,
                note: l.note,
                createdAt: l.createdAt,
            })),
            page,
            pageSize,
            total,
        });
    } catch (err) {
        console.error("[practical-lessons.GET]", err);
        return jsonError(500, "INTERNAL_ERROR", "Lỗi khi tải danh sách buổi học");
    }
}

export async function POST(req: Request) {
    const { error, auth } = requireRouteAuth(req);
    if (error) return error;
    const forbidden = requireAdminRole(auth.role);
    if (forbidden) return forbidden;

    try {
        const body = await req.json().catch(() => null);
        if (!body) return jsonError(400, "VALIDATION_ERROR", "Invalid JSON");

        const studentId = typeof body.studentId === "string" ? body.studentId.trim() : "";
        const instructorId = typeof body.instructorId === "string" ? body.instructorId.trim() : "";
        const startAtRaw = typeof body.startAt === "string" ? body.startAt.trim() : "";
        const endAtRaw = typeof body.endAt === "string" ? body.endAt.trim() : null;
        const location = typeof body.location === "string" ? body.location.trim() || null : null;
        const lessonType = typeof body.lessonType === "string" ? body.lessonType.trim() : "";
        const note = typeof body.note === "string" ? body.note.trim() || null : null;

        if (!studentId || !instructorId || !startAtRaw || !lessonType) {
            return jsonError(400, "VALIDATION_ERROR", "Thiếu thông tin bắt buộc: studentId, instructorId, startAt, lessonType");
        }

        const validTypes = ["SA_HINH", "DUONG_TRUONG", "DAT", "CABIN", "OTHER"];
        if (!validTypes.includes(lessonType)) {
            return jsonError(400, "VALIDATION_ERROR", `lessonType phải là: ${validTypes.join(", ")}`);
        }

        const startAt = new Date(startAtRaw);
        const endAt = endAtRaw ? new Date(endAtRaw) : null;
        if (isNaN(startAt.getTime())) return jsonError(400, "VALIDATION_ERROR", "startAt không hợp lệ");
        if (endAt && isNaN(endAt.getTime())) return jsonError(400, "VALIDATION_ERROR", "endAt không hợp lệ");
        if (endAt && endAt <= startAt) return jsonError(400, "VALIDATION_ERROR", "endAt phải sau startAt");

        const instructor = await prisma.instructor.findUnique({ where: { id: instructorId } });
        if (!instructor) return jsonError(404, "NOT_FOUND", "Không tìm thấy giáo viên");
        if (instructor.status === "INACTIVE") return jsonError(400, "VALIDATION_ERROR", "Giáo viên đã ngừng hoạt động");

        const student = await prisma.student.findUnique({ where: { id: studentId } });
        if (!student) return jsonError(404, "NOT_FOUND", "Không tìm thấy học viên");

        // Overlap check
        const checkEnd = endAt || new Date(startAt.getTime() + 60 * 60 * 1000); // default 1h
        const overlap = await prisma.practicalLesson.findFirst({
            where: {
                instructorId,
                status: "SCHEDULED",
                startAt: { lt: checkEnd },
                OR: [
                    { endAt: { gt: startAt } },
                    { endAt: null, startAt: { gte: startAt, lt: checkEnd } },
                ],
            },
        });
        if (overlap) {
            return jsonError(409, "CONFLICT", "Giáo viên đã có lịch trùng trong khung giờ này");
        }

        const lesson = await prisma.practicalLesson.create({
            data: {
                studentId,
                instructorId,
                startAt,
                endAt,
                location,
                lessonType: lessonType as "SA_HINH" | "DUONG_TRUONG" | "DAT" | "CABIN" | "OTHER",
                note,
            },
        });

        return NextResponse.json(lesson, { status: 201 });
    } catch (err) {
        console.error("[practical-lessons.POST]", err);
        return jsonError(500, "INTERNAL_ERROR", "Lỗi khi tạo buổi học");
    }
}
