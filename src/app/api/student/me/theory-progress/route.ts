import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError } from "@/lib/api-response";
import { requireStudentAuth, StudentAuthError } from "@/lib/student-auth";

function corsHeaders() {
    return {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
    };
}

export async function OPTIONS() {
    return new NextResponse(null, { status: 204, headers: corsHeaders() });
}

/**
 * GET — Return latest theory progress for the authenticated student
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
        const todayKey = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Ho_Chi_Minh" });

        const snapshot = await prisma.appDailySnapshot.findUnique({
            where: { studentId_dateKey: { studentId: auth.studentId, dateKey: todayKey } },
        });

        // Also get cumulative from the latest snapshot
        const latestSnapshot = await prisma.appDailySnapshot.findFirst({
            where: { studentId: auth.studentId },
            orderBy: { dateKey: "desc" },
        });

        if (!latestSnapshot) {
            const res = NextResponse.json({
                answered: 0, total: 600, correct: 0, wrong: 0, streak: 0,
                accuracy: 0, topics: [], lastSyncAt: null,
            });
            Object.entries(corsHeaders()).forEach(([k, v]) => res.headers.set(k, v));
            return res;
        }

        const res = NextResponse.json({
            answered: latestSnapshot.questionsAnswered,
            total: 600,
            correct: latestSnapshot.correct,
            wrong: latestSnapshot.questionsAnswered - latestSnapshot.correct,
            streak: latestSnapshot.streakCurrent,
            accuracy: latestSnapshot.accuracy,
            topics: (latestSnapshot.topWeakTopics as Array<{ id: string; name: string; answered: number; total: number; correct: number }>) || [],
            lastSyncAt: latestSnapshot.lastActiveAt,
            todayMinutes: snapshot?.minutes ?? 0,
            todayQuestions: snapshot?.questionsAnswered ?? 0,
        });
        Object.entries(corsHeaders()).forEach(([k, v]) => res.headers.set(k, v));
        return res;
    } catch (err) {
        console.error("[student.me.theory-progress.GET]", err);
        return jsonError(500, "INTERNAL_ERROR", "Internal server error");
    }
}

/**
 * POST — Receive theory progress data from the learning app
 * Body: { answered, correct, wrong, streak, accuracy, topics }
 */
export async function POST(req: Request) {
    let auth;
    try {
        auth = requireStudentAuth(req);
    } catch (error) {
        if (error instanceof StudentAuthError) {
            const r = jsonError(error.status, error.code, error.message);
            Object.entries(corsHeaders()).forEach(([k, v]) => r.headers.set(k, v));
            return r;
        }
        const r = jsonError(401, "AUTH_INVALID_TOKEN", "Unauthorized");
        Object.entries(corsHeaders()).forEach(([k, v]) => r.headers.set(k, v));
        return r;
    }

    try {
        const body = await req.json().catch(() => null);
        if (!body) {
            const r = jsonError(400, "INVALID_JSON", "Invalid JSON body");
            Object.entries(corsHeaders()).forEach(([k, v]) => r.headers.set(k, v));
            return r;
        }

        const dateKey = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Ho_Chi_Minh" });

        const snapshot = await prisma.appDailySnapshot.upsert({
            where: { studentId_dateKey: { studentId: auth.studentId, dateKey } },
            create: {
                studentId: auth.studentId,
                dateKey,
                minutes: body.minutes ?? 0,
                questionsAnswered: body.answered ?? 0,
                correct: body.correct ?? 0,
                accuracy: body.accuracy ?? 0,
                streakCurrent: body.streak ?? 0,
                streakLongest: body.streak ?? 0,
                dueCount: body.wrong ?? 0,
                topWeakTopics: body.topics ?? [],
                lastActiveAt: new Date(),
            },
            update: {
                minutes: body.minutes ?? undefined,
                questionsAnswered: body.answered ?? 0,
                correct: body.correct ?? 0,
                accuracy: body.accuracy ?? 0,
                streakCurrent: body.streak ?? 0,
                streakLongest: { set: Math.max(body.streak ?? 0, 0) },
                dueCount: body.wrong ?? 0,
                topWeakTopics: body.topics ?? [],
                lastActiveAt: new Date(),
            },
        });

        const res = NextResponse.json({ ok: true, id: snapshot.id });
        Object.entries(corsHeaders()).forEach(([k, v]) => res.headers.set(k, v));
        return res;
    } catch (err) {
        console.error("[student.me.theory-progress.POST]", err);
        const r = jsonError(500, "INTERNAL_ERROR", "Internal server error");
        Object.entries(corsHeaders()).forEach(([k, v]) => r.headers.set(k, v));
        return r;
    }
}
