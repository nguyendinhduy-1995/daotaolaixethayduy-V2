import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError } from "@/lib/api-response";
import { verifyServiceOrStudentAuth } from "@/lib/service-auth";

export async function POST(req: Request) {
    const auth = await verifyServiceOrStudentAuth(req);
    if (!auth.ok) return auth.response;

    const body = auth.body as {
        studentId: string;
        dateKey: string;
        minutes?: number;
        questionsAnswered?: number;
        correct?: number;
        accuracy?: number;
        streakCurrent?: number;
        streakLongest?: number;
        dueCount?: number;
        topWeakTopics?: unknown;
        lastActiveAt?: string;
    };

    if (!body.studentId || !body.dateKey) {
        return jsonError(400, "VALIDATION_ERROR", "studentId and dateKey are required");
    }

    // Validate dateKey format (YYYY-MM-DD)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(body.dateKey)) {
        return jsonError(400, "VALIDATION_ERROR", "dateKey must be YYYY-MM-DD format");
    }

    // Verify student exists
    const student = await prisma.student.findUnique({ where: { id: body.studentId } });
    if (!student) return jsonError(404, "NOT_FOUND", "Student not found");

    try {
        const snapshot = await prisma.appDailySnapshot.upsert({
            where: {
                studentId_dateKey: { studentId: body.studentId, dateKey: body.dateKey },
            },
            create: {
                studentId: body.studentId,
                dateKey: body.dateKey,
                minutes: body.minutes ?? 0,
                questionsAnswered: body.questionsAnswered ?? 0,
                correct: body.correct ?? 0,
                accuracy: body.accuracy ?? 0,
                streakCurrent: body.streakCurrent ?? 0,
                streakLongest: body.streakLongest ?? 0,
                dueCount: body.dueCount ?? 0,
                topWeakTopics: body.topWeakTopics as object ?? undefined,
                lastActiveAt: body.lastActiveAt ? new Date(body.lastActiveAt) : new Date(),
            },
            update: {
                minutes: body.minutes ?? 0,
                questionsAnswered: body.questionsAnswered ?? 0,
                correct: body.correct ?? 0,
                accuracy: body.accuracy ?? 0,
                streakCurrent: body.streakCurrent ?? 0,
                streakLongest: body.streakLongest ?? 0,
                dueCount: body.dueCount ?? 0,
                topWeakTopics: body.topWeakTopics as object ?? undefined,
                lastActiveAt: body.lastActiveAt ? new Date(body.lastActiveAt) : new Date(),
            },
        });

        return NextResponse.json({ ok: true, id: snapshot.id });
    } catch (err) {
        console.error("[student-progress.daily]", err);
        return jsonError(500, "INTERNAL_ERROR", "Failed to upsert daily snapshot");
    }
}
