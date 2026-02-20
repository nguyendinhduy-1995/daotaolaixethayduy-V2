import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError } from "@/lib/api-response";
import { verifyServiceOrStudentAuth } from "@/lib/service-auth";

export async function POST(req: Request) {
    const auth = await verifyServiceOrStudentAuth(req);
    if (!auth.ok) return auth.response;

    const body = auth.body as {
        studentId: string;
        attemptId: string;
        mode: string;
        startedAt: string;
        finishedAt: string;
        score: number;
        total: number;
        accuracy: number;
        topicBreakdown?: unknown;
    };

    if (!body.studentId || !body.attemptId || !body.mode) {
        return jsonError(400, "VALIDATION_ERROR", "studentId, attemptId, and mode are required");
    }

    // Verify student exists
    const student = await prisma.student.findUnique({ where: { id: body.studentId } });
    if (!student) return jsonError(404, "NOT_FOUND", "Student not found");

    // Idempotent: if attemptId exists, return success
    const existing = await prisma.appAttemptSummary.findUnique({ where: { attemptId: body.attemptId } });
    if (existing) {
        return NextResponse.json({ ok: true, id: existing.id, deduplicated: true });
    }

    try {
        const attempt = await prisma.appAttemptSummary.create({
            data: {
                studentId: body.studentId,
                attemptId: body.attemptId,
                mode: body.mode,
                startedAt: body.startedAt ? new Date(body.startedAt) : (body.finishedAt ? new Date(body.finishedAt) : new Date()),
                finishedAt: body.finishedAt ? new Date(body.finishedAt) : new Date(),
                score: body.score ?? 0,
                total: body.total ?? 0,
                accuracy: body.accuracy ?? 0,
                topicBreakdown: body.topicBreakdown as object ?? undefined,
            },
        });

        return NextResponse.json({ ok: true, id: attempt.id });
    } catch (err) {
        console.error("[student-progress.attempt]", err);
        return jsonError(500, "INTERNAL_ERROR", "Failed to create attempt summary");
    }
}
