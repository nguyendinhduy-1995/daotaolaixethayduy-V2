import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError } from "@/lib/api-response";
import { requireStudentAuth, StudentAuthError } from "@/lib/student-auth";

/**
 * GET /api/student/me/simulation-progress
 * Returns Mophong simulation progress for the logged-in student.
 */
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

    try {
        const studentId = auth.studentId;

        // Recent attempts (simulations)
        const recentAttempts = await prisma.appAttemptSummary.findMany({
            where: { studentId },
            orderBy: { createdAt: "desc" },
            take: 10,
        });

        // Recent events
        const recentEvents = await prisma.appEventLog.findMany({
            where: { studentId },
            orderBy: { occurredAt: "desc" },
            take: 10,
        });

        // Aggregate stats
        const totalAttempts = await prisma.appAttemptSummary.count({
            where: { studentId },
        });
        const avgAccuracy = totalAttempts > 0
            ? await prisma.appAttemptSummary.aggregate({
                where: { studentId },
                _avg: { accuracy: true },
            }).then(r => Math.round(r._avg.accuracy ?? 0))
            : 0;

        return NextResponse.json({
            ok: true,
            totalAttempts,
            avgAccuracy,
            recentAttempts: recentAttempts.map((a) => ({
                attemptId: a.attemptId,
                mode: a.mode,
                score: a.score,
                total: a.total,
                accuracy: a.accuracy,
                finishedAt: a.finishedAt.toISOString(),
            })),
            recentEvents: recentEvents.map((e) => ({
                eventId: e.eventId,
                type: e.type,
                occurredAt: e.occurredAt.toISOString(),
            })),
        });
    } catch (err) {
        console.error("[student.me.simulation-progress]", err);
        return jsonError(500, "INTERNAL_ERROR", "Failed to load simulation progress");
    }
}
