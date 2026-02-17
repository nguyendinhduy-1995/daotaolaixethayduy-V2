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

    const student = await prisma.student.findUnique({
        where: { id: auth.studentId },
        select: { instructorId: true },
    });
    if (!student) return jsonError(404, "NOT_FOUND", "Không tìm thấy học viên");

    if (!student.instructorId) {
        return NextResponse.json({ instructor: null });
    }

    const instructor = await prisma.instructor.findUnique({
        where: { id: student.instructorId },
        select: { id: true, name: true, phone: true, status: true },
    });

    return NextResponse.json({ instructor });
}
