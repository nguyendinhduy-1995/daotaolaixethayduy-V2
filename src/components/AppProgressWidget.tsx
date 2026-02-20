"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchJson, type ApiClientError } from "@/lib/api-client";
import { getToken } from "@/lib/auth-client";

type WeeklyItem = { dateKey: string; minutes: number; questionsAnswered: number; accuracy: number };
type MockItem = { attemptId: string; mode: string; score: number; total: number; accuracy: number; finishedAt: string; topicBreakdown: unknown };
type AiSummary = { passProbability: number; strengths: unknown; weaknesses: unknown; todayPlan: unknown; generatedAt: string };
type WeakTopic = { topicId: string; accuracy: number };

type ProgressData = {
    today: { minutes: number; questionsAnswered: number; accuracy: number; streak: number; dueCount: number } | null;
    weeklyTrend: WeeklyItem[];
    totalMinutes7d: number;
    totalQuestions7d: number;
    streak: { current: number; longest: number };
    weakTopics: WeakTopic[];
    recentMocks: MockItem[];
    aiSummary: AiSummary | null;
};

export function AppProgressWidget({ studentId }: { studentId: string }) {
    const [data, setData] = useState<ProgressData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const loadProgress = useCallback(async () => {
        const token = getToken();
        if (!token) return;
        setLoading(true);
        try {
            const res = await fetchJson<{ ok: boolean; data: ProgressData }>(
                `/api/students/${studentId}/app-progress`,
                { token }
            );
            setData(res.data);
        } catch (e) {
            const err = e as ApiClientError;
            setError(err.message || "Không tải được dữ liệu app");
        } finally {
            setLoading(false);
        }
    }, [studentId]);

    useEffect(() => {
        loadProgress();
    }, [loadProgress]);

    if (loading) {
        return (
            <div className="rounded-lg border border-violet-200 bg-violet-50/50 p-4">
                <h3 className="mb-2 text-sm font-semibold text-violet-900">📱 Tiến độ App Học Lý Thuyết</h3>
                <p className="text-sm text-zinc-500">Đang tải...</p>
            </div>
        );
    }

    if (error || !data) {
        return (
            <div className="rounded-lg border border-violet-200 bg-violet-50/50 p-4">
                <h3 className="mb-2 text-sm font-semibold text-violet-900">📱 Tiến độ App Học Lý Thuyết</h3>
                <p className="text-sm text-zinc-400">Chưa có dữ liệu từ app</p>
            </div>
        );
    }

    const { today, streak, weeklyTrend, totalMinutes7d, totalQuestions7d, weakTopics, recentMocks, aiSummary } = data;
    const latestMock = recentMocks[0] ?? null;

    return (
        <div className="rounded-lg border border-violet-200 bg-violet-50/50 p-4 space-y-4">
            <h3 className="text-sm font-semibold text-violet-900">📱 Tiến độ App Học Lý Thuyết</h3>

            {/* AI Pass Probability + Today Plan */}
            {aiSummary && (
                <div className="rounded-lg bg-gradient-to-r from-violet-100 to-purple-100 p-3 space-y-2">
                    <div className="flex items-center gap-3">
                        <span className="text-2xl font-bold text-violet-800">{aiSummary.passProbability}%</span>
                        <span className="text-xs text-violet-600">Xác suất đậu (AI)</span>
                    </div>
                    {Array.isArray(aiSummary.todayPlan) && aiSummary.todayPlan.length > 0 && (
                        <div className="space-y-1">
                            <p className="text-xs font-semibold text-violet-700">📋 Kế hoạch hôm nay:</p>
                            {(aiSummary.todayPlan as string[]).map((plan, i) => (
                                <p key={i} className="text-xs text-violet-600 ml-3">• {plan}</p>
                            ))}
                        </div>
                    )}
                    <div className="flex gap-2 flex-wrap">
                        {Array.isArray(aiSummary.strengths) && (aiSummary.strengths as string[]).slice(0, 2).map((s, i) => (
                            <span key={i} className="text-xs rounded-full bg-green-100 text-green-700 px-2 py-0.5">💪 {s}</span>
                        ))}
                        {Array.isArray(aiSummary.weaknesses) && (aiSummary.weaknesses as string[]).slice(0, 2).map((w, i) => (
                            <span key={i} className="text-xs rounded-full bg-red-100 text-red-700 px-2 py-0.5">⚡ {w}</span>
                        ))}
                    </div>
                </div>
            )}

            {/* Key Metrics Grid */}
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <div className="rounded-lg bg-white p-2.5 border border-zinc-100 text-center">
                    <p className="text-lg font-bold text-orange-600">🔥 {streak.current}</p>
                    <p className="text-[10px] text-zinc-500">Streak (Max: {streak.longest})</p>
                </div>
                <div className="rounded-lg bg-white p-2.5 border border-zinc-100 text-center">
                    <p className="text-lg font-bold text-blue-600">{totalMinutes7d}p</p>
                    <p className="text-[10px] text-zinc-500">Phút 7 ngày</p>
                </div>
                <div className="rounded-lg bg-white p-2.5 border border-zinc-100 text-center">
                    <p className="text-lg font-bold text-emerald-600">{totalQuestions7d}</p>
                    <p className="text-[10px] text-zinc-500">Câu 7 ngày</p>
                </div>
                <div className="rounded-lg bg-white p-2.5 border border-zinc-100 text-center">
                    <p className="text-lg font-bold text-amber-600">{today?.dueCount ?? 0}</p>
                    <p className="text-[10px] text-zinc-500">Câu đến hạn ôn</p>
                </div>
            </div>

            {/* 7-day trend mini chart */}
            {weeklyTrend.length > 0 && (
                <div className="space-y-1">
                    <p className="text-xs font-semibold text-zinc-600">📊 7 ngày gần nhất</p>
                    <div className="flex gap-1 items-end h-12">
                        {weeklyTrend.slice().reverse().map((d) => {
                            const h = Math.max(4, Math.min(48, (d.minutes / 30) * 48));
                            return (
                                <div key={d.dateKey} className="flex-1 flex flex-col items-center gap-0.5">
                                    <div
                                        className="w-full rounded-sm bg-violet-300"
                                        style={{ height: `${h}px` }}
                                        title={`${d.dateKey}: ${d.minutes}p, ${d.questionsAnswered} câu, ${d.accuracy}%`}
                                    />
                                    <span className="text-[8px] text-zinc-400">{d.dateKey.slice(8)}</span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Latest mock */}
            {latestMock && (
                <div className="rounded-lg bg-white p-2.5 border border-zinc-100 space-y-1">
                    <p className="text-xs font-semibold text-zinc-600">🏆 Mock gần nhất</p>
                    <div className="flex items-center gap-3">
                        <span className="text-lg font-bold" style={{ color: latestMock.accuracy >= 80 ? "#16a34a" : latestMock.accuracy >= 60 ? "#d97706" : "#dc2626" }}>
                            {latestMock.score}/{latestMock.total}
                        </span>
                        <span className="text-sm text-zinc-500">({latestMock.accuracy}%)</span>
                        <span className="text-xs text-zinc-400 ml-auto">
                            {new Date(latestMock.finishedAt).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                        </span>
                    </div>
                </div>
            )}

            {/* Weak topics */}
            {Array.isArray(weakTopics) && weakTopics.length > 0 && (
                <div className="space-y-1">
                    <p className="text-xs font-semibold text-zinc-600">⚡ Top chủ đề yếu</p>
                    <div className="flex gap-1.5 flex-wrap">
                        {(weakTopics as WeakTopic[]).slice(0, 3).map((t, i) => (
                            <span key={i} className="text-xs rounded-full bg-red-50 text-red-600 border border-red-200 px-2 py-0.5">
                                {t.topicId}: {t.accuracy}%
                            </span>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
