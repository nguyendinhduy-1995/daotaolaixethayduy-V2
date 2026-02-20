import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError } from "@/lib/api-response";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(req: Request, context: RouteContext) {
    const { id: studentId } = await context.params;

    // Verify student exists
    const student = await prisma.student.findUnique({ where: { id: studentId } });
    if (!student) return jsonError(404, "NOT_FOUND", "Student not found");

    // 1. Latest daily snapshots (last 7 days)
    const dailySnapshots = await prisma.appDailySnapshot.findMany({
        where: { studentId },
        orderBy: { dateKey: "desc" },
        take: 7,
    });

    // 2. Latest mock attempts (last 5)
    const recentAttempts = await prisma.appAttemptSummary.findMany({
        where: { studentId },
        orderBy: { createdAt: "desc" },
        take: 5,
    });

    // 3. AI summary (latest)
    const aiSummary = await prisma.appAiSummary.findUnique({
        where: { studentId },
    });

    // 4. Computed aggregates
    const todayKey = new Date()
        .toLocaleDateString("sv-SE", { timeZone: "Asia/Ho_Chi_Minh" });
    const todaySnapshot = dailySnapshots.find((s) => s.dateKey === todayKey);

    const totalMinutes7d = dailySnapshots.reduce((sum, s) => sum + s.minutes, 0);
    const totalQuestions7d = dailySnapshots.reduce((sum, s) => sum + s.questionsAnswered, 0);

    return NextResponse.json({
        ok: true,
        data: {
            // Today
            today: todaySnapshot
                ? {
                    minutes: todaySnapshot.minutes,
                    questionsAnswered: todaySnapshot.questionsAnswered,
                    accuracy: todaySnapshot.accuracy,
                    streak: todaySnapshot.streakCurrent,
                    dueCount: todaySnapshot.dueCount,
                }
                : null,

            // 7-day trend
            weeklyTrend: dailySnapshots.map((s) => ({
                dateKey: s.dateKey,
                minutes: s.minutes,
                questionsAnswered: s.questionsAnswered,
                accuracy: s.accuracy,
            })),
            totalMinutes7d,
            totalQuestions7d,

            // Streak
            streak: todaySnapshot
                ? { current: todaySnapshot.streakCurrent, longest: todaySnapshot.streakLongest }
                : dailySnapshots[0]
                    ? { current: dailySnapshots[0].streakCurrent, longest: dailySnapshots[0].streakLongest }
                    : { current: 0, longest: 0 },

            // Weak topics
            weakTopics: todaySnapshot?.topWeakTopics ?? dailySnapshots[0]?.topWeakTopics ?? [],

            // Recent mocks
            recentMocks: recentAttempts.map((a) => ({
                attemptId: a.attemptId,
                mode: a.mode,
                score: a.score,
                total: a.total,
                accuracy: a.accuracy,
                finishedAt: a.finishedAt,
                topicBreakdown: a.topicBreakdown,
            })),

            // AI Coach
            aiSummary: aiSummary
                ? {
                    passProbability: aiSummary.passProbability,
                    strengths: aiSummary.strengths,
                    weaknesses: aiSummary.weaknesses,
                    todayPlan: aiSummary.todayPlan,
                    generatedAt: aiSummary.generatedAt,
                }
                : null,
        },
    });
}
