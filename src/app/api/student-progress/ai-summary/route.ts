import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError } from "@/lib/api-response";
import { verifyServiceOrStudentAuth } from "@/lib/service-auth";

export async function POST(req: Request) {
    const auth = await verifyServiceOrStudentAuth(req);
    if (!auth.ok) return auth.response;

    const body = auth.body as {
        studentId: string;
        passProbability: number;
        strengths: string[];
        weaknesses: string[];
        todayPlan: string[];
        generatedAt: string;
    };

    if (!body.studentId || body.passProbability == null) {
        return jsonError(400, "VALIDATION_ERROR", "studentId and passProbability are required");
    }

    // Verify student exists
    const student = await prisma.student.findUnique({ where: { id: body.studentId } });
    if (!student) return jsonError(404, "NOT_FOUND", "Student not found");

    try {
        const summary = await prisma.appAiSummary.upsert({
            where: { studentId: body.studentId },
            create: {
                studentId: body.studentId,
                passProbability: body.passProbability,
                strengths: body.strengths ?? [],
                weaknesses: body.weaknesses ?? [],
                todayPlan: body.todayPlan ?? [],
                generatedAt: body.generatedAt ? new Date(body.generatedAt) : new Date(),
            },
            update: {
                passProbability: body.passProbability,
                strengths: body.strengths ?? [],
                weaknesses: body.weaknesses ?? [],
                todayPlan: body.todayPlan ?? [],
                generatedAt: body.generatedAt ? new Date(body.generatedAt) : new Date(),
            },
        });

        return NextResponse.json({ ok: true, id: summary.id });
    } catch (err) {
        console.error("[student-progress.ai-summary]", err);
        return jsonError(500, "INTERNAL_ERROR", "Failed to upsert AI summary");
    }
}
