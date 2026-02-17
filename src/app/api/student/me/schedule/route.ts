import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError } from "@/lib/api-response";
import { requireStudentAuth, StudentAuthError } from "@/lib/student-auth";

export async function GET(req: Request) {
    let auth;
    try {
        auth = requireStudentAuth(req);
    } catch (error) {
        if (error instanceof StudentAuthError) {
            return jsonError(error.status, error.code, error.message);
        }
        return jsonError(401, "AUTH_INVALID_TOKEN", "Unauthorized");
    }

    const now = new Date();
    const next14d = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

    const lessons = await prisma.practicalLesson.findMany({
        where: {
            studentId: auth.studentId,
            status: "SCHEDULED",
            startAt: { gte: now, lte: next14d },
        },
        orderBy: { startAt: "asc" },
        take: 20,
        include: {
            instructor: { select: { name: true, phone: true } },
        },
    });

    return NextResponse.json({
        items: lessons.map((l) => ({
            id: l.id,
            startAt: l.startAt,
            endAt: l.endAt,
            location: l.location,
            lessonType: l.lessonType,
            status: l.status,
            instructorName: l.instructor.name,
            instructorPhone: l.instructor.phone,
            note: l.note,
        })),
    });
}
