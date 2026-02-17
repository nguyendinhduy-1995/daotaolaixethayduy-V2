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

    const plan = await prisma.studentExamPlan.findUnique({
        where: { studentId: auth.studentId },
    });

    return NextResponse.json(plan || {
        studentId: auth.studentId,
        estimatedGraduationAt: null,
        estimatedExamAt: null,
        note: null,
    });
}
