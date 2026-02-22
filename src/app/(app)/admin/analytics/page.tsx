"use client";

import { useEffect, useState, useCallback } from "react";
import { fetchJson } from "@/lib/api-client";
import { getToken } from "@/lib/auth-client";
import { Spinner } from "@/components/ui/spinner";

/* ── Types ─────────────────────────────────────────────────── */
type NameCount = { name: string; count: number };
type AnalyticsData = {
    date: string;
    siteFilter: string;
    totalPageViews: number;
    uniqueSessions: number;
    realUsers: number;
    newUsers: number;
    returningUsers: number;
    avgDuration: number;
    avgPagesPerSession: number;
    bounceRate: number;
    engagementRate: number;
    viewsChange: number;
    sessionsChange: number;
    yesterdayPageViews: number;
    yesterdaySessions: number;
    topPages: Array<{ page: string; count: number; pct: number }>;
    eventBreakdown: Record<string, number>;
    deviceBreakdown: { mobile: number; desktop: number; mobilePercent: number };
    screenSizes: Record<string, number>;
    hourlyTraffic: number[];
    peakHour: number;
    siteBreakdown: Record<string, number>;
    topReferrers: Array<{ source: string; count: number }>;
    topEntryPages: Array<{ page: string; count: number }>;
    topExitPages: Array<{ page: string; count: number }>;
    landingFunnel: {
        visitors: number; pricingViewed: number; ctaClicks: number;
        formViewed: number; formFocused: number; formSubmitted: number;
        phoneCalls: number; zaloClicks: number;
    };
    conversionRate: number;
    siteSpecificStats: {
        mophong?: { topScenarios: NameCount[]; topVideos: NameCount[]; examStarts: number; examFinishes: number; examCompletionRate: number; totalBrakes: number };
        taplai?: { topTopics: NameCount[]; topSearches: NameCount[]; totalAnswers: number; correctAnswers: number; correctRate: number; dailyPractices: number; wrongReviews: number };
        landing?: { topSections: NameCount[]; funnelDetail: AnalyticsData["landingFunnel"]; conversionRate: number };
    };
    insights: string[];
};

type SiteTab = "all" | "mophong" | "taplai" | "landing";
const TABS: { key: SiteTab; label: string; icon: string; color: string; active: string }[] = [
    { key: "all", label: "Tất cả", icon: "🌍", color: "text-zinc-600", active: "bg-zinc-800 text-white" },
    { key: "mophong", label: "Mô Phỏng", icon: "🚗", color: "text-blue-600", active: "bg-blue-600 text-white" },
    { key: "taplai", label: "Lý Thuyết", icon: "📚", color: "text-violet-600", active: "bg-violet-600 text-white" },
    { key: "landing", label: "Landing", icon: "🌐", color: "text-amber-600", active: "bg-amber-600 text-white" },
];

function fmtDuration(s: number) { return s > 60 ? `${Math.floor(s / 60)}p${s % 60}s` : `${s}s`; }
function changeBadge(v: number) { return v >= 0 ? `📈 +${v}%` : `📉 ${v}%`; }

/* ── Page ──────────────────────────────────────────────────── */
export default function AnalyticsPage() {
    const today = new Date().toISOString().slice(0, 10);
    const [selectedDate, setSelectedDate] = useState(today);
    const [activeTab, setActiveTab] = useState<SiteTab>("all");
    const [data, setData] = useState<AnalyticsData | null>(null);
    const [loading, setLoading] = useState(false);
    const [aiReport, setAiReport] = useState<string | null>(null);
    const [aiLoading, setAiLoading] = useState(false);
    const [error, setError] = useState("");

    const loadData = useCallback(async (date: string, site: SiteTab) => {
        setLoading(true); setError(""); setAiReport(null);
        try {
            const token = getToken(); if (!token) return;
            const siteParam = site === "all" ? "" : `&site=${site}`;
            const result = await fetchJson<AnalyticsData>(`/api/analytics/dashboard?date=${date}${siteParam}`, { token });
            setData(result);
        } catch (e) { setError(e instanceof Error ? e.message : "Không thể tải dữ liệu"); } finally { setLoading(false); }
    }, []);

    useEffect(() => { loadData(selectedDate, activeTab); }, [selectedDate, activeTab, loadData]);

    const runAi = async () => {
        const token = getToken(); if (!token) return;
        setAiLoading(true); setAiReport(null);
        try {
            const res = await fetchJson<{ analysis: string }>(`/api/analytics/ai-report?date=${selectedDate}`, { token, method: "POST" });
            setAiReport(res.analysis);
        } catch { setAiReport("Không thể tạo báo cáo AI."); } finally { setAiLoading(false); }
    };

    const switchTab = (tab: SiteTab) => { setActiveTab(tab); };

    return (
        <div className="space-y-4">
            {/* ── Header ── */}
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h1 className="text-xl font-bold text-zinc-800">📈 Phân tích truy cập website</h1>
                    <p className="text-sm text-zinc-500">Theo dõi người dùng, hành vi và chuyển đổi</p>
                </div>
                <div className="flex items-center gap-2">
                    <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} max={today}
                        className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-400 focus:ring-2 focus:ring-blue-100" />
                    <button type="button" onClick={() => setSelectedDate(today)} className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs font-medium text-zinc-600 hover:bg-zinc-50">Hôm nay</button>
                    <button type="button" onClick={() => loadData(selectedDate, activeTab)} disabled={loading} className="rounded-xl bg-blue-600 px-3 py-2 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50 shadow-sm">
                        {loading ? <Spinner /> : "🔄 Tải lại"}
                    </button>
                </div>
            </div>

            {/* ── Tab Bar ── */}
            <div className="flex gap-1.5 rounded-2xl bg-zinc-100/80 p-1.5">
                {TABS.map(tab => (
                    <button key={tab.key} type="button" onClick={() => switchTab(tab.key)}
                        className={`flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-medium transition-all duration-200 ${activeTab === tab.key ? `${tab.active} shadow-md` : `bg-white/60 ${tab.color} hover:bg-white hover:shadow-sm`}`}>
                        <span>{tab.icon}</span> {tab.label}
                    </button>
                ))}
            </div>

            {error ? <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}
            {loading && !data ? <div className="flex items-center justify-center py-16"><Spinner /> <span className="ml-2 text-sm text-zinc-500">Đang tải...</span></div> : null}

            {data ? (
                <>
                    {/* ── Insights ── */}
                    {data.insights.length > 0 ? (
                        <div className="rounded-2xl border border-indigo-200/60 bg-gradient-to-r from-indigo-50 to-violet-50 p-4">
                            <p className="text-xs font-bold uppercase tracking-wide text-indigo-600 mb-2">💡 Gợi ý hành động — {data.date}</p>
                            <div className="space-y-1.5">{data.insights.map((s, i) => <p key={i} className="text-sm text-zinc-700 leading-snug">{s}</p>)}</div>
                        </div>
                    ) : null}

                    {/* ── 6 Overview Cards ── */}
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
                        {[
                            { icon: "👤", label: "Người dùng thật", val: data.realUsers, sub: `🆕 ${data.newUsers} mới · 🔄 ${data.returningUsers} quay lại`, color: "border-blue-200 from-blue-50 to-blue-100/30" },
                            { icon: "👁️", label: "Lượt xem trang", val: data.totalPageViews, sub: `${changeBadge(data.viewsChange)} vs hôm qua (${data.yesterdayPageViews})`, color: "border-indigo-200 from-indigo-50 to-indigo-100/30" },
                            { icon: "📊", label: "Phiên truy cập", val: data.uniqueSessions, sub: `${changeBadge(data.sessionsChange)} vs hôm qua (${data.yesterdaySessions})`, color: "border-violet-200 from-violet-50 to-violet-100/30" },
                            { icon: "⏱️", label: "Thời gian TB", val: fmtDuration(data.avgDuration), sub: `${data.avgPagesPerSession} trang/phiên`, color: "border-amber-200 from-amber-50 to-amber-100/30" },
                            { icon: "🎯", label: "Tỷ lệ tương tác", val: `${data.engagementRate}%`, sub: `Bounce: ${data.bounceRate}%`, color: "border-emerald-200 from-emerald-50 to-emerald-100/30" },
                            { icon: "📱", label: "Mobile", val: `${data.deviceBreakdown.mobilePercent}%`, sub: `📱 ${data.deviceBreakdown.mobile} · 💻 ${data.deviceBreakdown.desktop}`, color: "border-cyan-200 from-cyan-50 to-cyan-100/30" },
                        ].map(c => (
                            <div key={c.label} className={`rounded-2xl border ${c.color} bg-gradient-to-br p-4 transition-all hover:shadow-lg`}>
                                <div className="flex items-center gap-1.5 mb-1"><span className="text-lg">{c.icon}</span><p className="text-[11px] uppercase tracking-wide text-zinc-500">{c.label}</p></div>
                                <p className="text-2xl font-bold text-zinc-800">{c.val}</p>
                                <p className="text-[11px] text-zinc-500 mt-1">{c.sub}</p>
                            </div>
                        ))}
                    </div>

                    {/* ═══════════════════════════════════════════════════ */}
                    {/* ── Site-specific sections ── */}
                    {/* ═══════════════════════════════════════════════════ */}

                    {/* ── MÔ PHỎNG specific ── */}
                    {(activeTab === "mophong" || activeTab === "all") && data.siteSpecificStats?.mophong ? (() => {
                        const m = data.siteSpecificStats.mophong!;
                        return (
                            <div className="rounded-2xl border-2 border-blue-200/60 bg-gradient-to-br from-blue-50 via-white to-sky-50 p-5">
                                <p className="text-base font-bold text-blue-800 mb-4">🚗 Phân tích chi tiết — Mô Phỏng</p>
                                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-4">
                                    <div className="rounded-xl bg-white p-3 border border-blue-100 text-center">
                                        <p className="text-2xl font-bold text-blue-600">{m.examStarts}</p>
                                        <p className="text-xs text-zinc-500">Lượt thi thử</p>
                                    </div>
                                    <div className="rounded-xl bg-white p-3 border border-blue-100 text-center">
                                        <p className="text-2xl font-bold text-green-600">{m.examFinishes}</p>
                                        <p className="text-xs text-zinc-500">Hoàn thành thi</p>
                                    </div>
                                    <div className="rounded-xl bg-white p-3 border border-blue-100 text-center">
                                        <p className={`text-2xl font-bold ${m.examCompletionRate >= 80 ? "text-green-600" : m.examCompletionRate >= 50 ? "text-amber-600" : "text-red-500"}`}>{m.examCompletionRate}%</p>
                                        <p className="text-xs text-zinc-500">Tỷ lệ hoàn thành</p>
                                    </div>
                                    <div className="rounded-xl bg-white p-3 border border-blue-100 text-center">
                                        <p className="text-2xl font-bold text-red-500">{m.totalBrakes}</p>
                                        <p className="text-xs text-zinc-500">Lượt nhấn phanh</p>
                                    </div>
                                </div>
                                <div className="grid gap-4 lg:grid-cols-2">
                                    {m.topScenarios.length > 0 ? (
                                        <div className="rounded-xl bg-white p-3 border border-blue-100">
                                            <p className="text-xs font-bold uppercase tracking-wide text-zinc-500 mb-2">🎬 Top tình huống xem nhiều</p>
                                            {m.topScenarios.map((s, i) => (
                                                <div key={s.name} className="flex items-center gap-2 text-xs py-1 border-b border-zinc-50 last:border-0">
                                                    <span className="text-zinc-400 w-5 text-right font-bold">{i + 1}.</span>
                                                    <span className="flex-1 text-zinc-700 font-medium truncate">{s.name}</span>
                                                    <span className="font-bold text-blue-600">{s.count} lượt</span>
                                                </div>
                                            ))}
                                        </div>
                                    ) : null}
                                    {m.topVideos.length > 0 ? (
                                        <div className="rounded-xl bg-white p-3 border border-blue-100">
                                            <p className="text-xs font-bold uppercase tracking-wide text-zinc-500 mb-2">▶️ Top video xem nhiều</p>
                                            {m.topVideos.map((v, i) => (
                                                <div key={v.name} className="flex items-center gap-2 text-xs py-1 border-b border-zinc-50 last:border-0">
                                                    <span className="text-zinc-400 w-5 text-right font-bold">{i + 1}.</span>
                                                    <span className="flex-1 text-zinc-700 font-medium truncate">{v.name}</span>
                                                    <span className="font-bold text-blue-600">{v.count} lượt</span>
                                                </div>
                                            ))}
                                        </div>
                                    ) : null}
                                </div>
                            </div>
                        );
                    })() : null}

                    {/* ── LÝ THUYẾT specific ── */}
                    {(activeTab === "taplai" || activeTab === "all") && data.siteSpecificStats?.taplai ? (() => {
                        const t = data.siteSpecificStats.taplai!;
                        return (
                            <div className="rounded-2xl border-2 border-violet-200/60 bg-gradient-to-br from-violet-50 via-white to-purple-50 p-5">
                                <p className="text-base font-bold text-violet-800 mb-4">📚 Phân tích chi tiết — Học Lý Thuyết</p>
                                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-4">
                                    <div className="rounded-xl bg-white p-3 border border-violet-100 text-center">
                                        <p className="text-2xl font-bold text-violet-600">{t.totalAnswers}</p>
                                        <p className="text-xs text-zinc-500">Câu trả lời</p>
                                    </div>
                                    <div className="rounded-xl bg-white p-3 border border-violet-100 text-center">
                                        <p className={`text-2xl font-bold ${t.correctRate >= 80 ? "text-green-600" : t.correctRate >= 60 ? "text-amber-600" : "text-red-500"}`}>{t.correctRate}%</p>
                                        <p className="text-xs text-zinc-500">Tỷ lệ đúng ({t.correctAnswers}/{t.totalAnswers})</p>
                                    </div>
                                    <div className="rounded-xl bg-white p-3 border border-violet-100 text-center">
                                        <p className="text-2xl font-bold text-teal-600">{t.dailyPractices}</p>
                                        <p className="text-xs text-zinc-500">Luyện tập hàng ngày</p>
                                    </div>
                                    <div className="rounded-xl bg-white p-3 border border-violet-100 text-center">
                                        <p className="text-2xl font-bold text-rose-500">{t.wrongReviews}</p>
                                        <p className="text-xs text-zinc-500">Xem lại câu sai</p>
                                    </div>
                                </div>
                                <div className="grid gap-4 lg:grid-cols-2">
                                    {t.topTopics.length > 0 ? (
                                        <div className="rounded-xl bg-white p-3 border border-violet-100">
                                            <p className="text-xs font-bold uppercase tracking-wide text-zinc-500 mb-2">📖 Chủ đề học nhiều nhất</p>
                                            {t.topTopics.map((s, i) => (
                                                <div key={s.name} className="flex items-center gap-2 text-xs py-1 border-b border-zinc-50 last:border-0">
                                                    <span className="text-zinc-400 w-5 text-right font-bold">{i + 1}.</span>
                                                    <span className="flex-1 text-zinc-700 font-medium truncate">{s.name}</span>
                                                    <span className="font-bold text-violet-600">{s.count} lượt</span>
                                                </div>
                                            ))}
                                        </div>
                                    ) : null}
                                    {t.topSearches.length > 0 ? (
                                        <div className="rounded-xl bg-white p-3 border border-violet-100">
                                            <p className="text-xs font-bold uppercase tracking-wide text-zinc-500 mb-2">🔍 Tìm kiếm phổ biến</p>
                                            {t.topSearches.map((s, i) => (
                                                <div key={s.name} className="flex items-center gap-2 text-xs py-1 border-b border-zinc-50 last:border-0">
                                                    <span className="text-zinc-400 w-5 text-right font-bold">{i + 1}.</span>
                                                    <span className="flex-1 text-zinc-700 font-medium truncate">{s.name}</span>
                                                    <span className="font-bold text-violet-600">{s.count} lượt</span>
                                                </div>
                                            ))}
                                        </div>
                                    ) : null}
                                </div>
                            </div>
                        );
                    })() : null}

                    {/* ── LANDING specific ── */}
                    {(activeTab === "landing" || activeTab === "all") && data.landingFunnel.visitors > 0 ? (
                        <div className="rounded-2xl border-2 border-amber-200/60 bg-gradient-to-br from-amber-50 via-white to-orange-50 p-5">
                            <div className="flex items-center justify-between mb-4">
                                <p className="text-base font-bold text-amber-800">🌐 Phân tích chi tiết — Landing Page</p>
                                <span className={`text-lg font-bold ${data.conversionRate >= 10 ? "text-green-600" : data.conversionRate >= 5 ? "text-amber-600" : "text-red-500"}`}>
                                    {data.conversionRate}% chuyển đổi
                                </span>
                            </div>
                            {/* Funnel */}
                            <div className="space-y-2 mb-4">
                                {[
                                    { l: "👁️ Truy cập", v: data.landingFunnel.visitors, p: 100 },
                                    { l: "💰 Xem bảng giá", v: data.landingFunnel.pricingViewed, p: data.landingFunnel.visitors > 0 ? Math.round((data.landingFunnel.pricingViewed / data.landingFunnel.visitors) * 100) : 0 },
                                    { l: "🔔 CTA clicks", v: data.landingFunnel.ctaClicks, p: data.landingFunnel.visitors > 0 ? Math.round((data.landingFunnel.ctaClicks / data.landingFunnel.visitors) * 100) : 0 },
                                    { l: "📋 Mở form", v: data.landingFunnel.formViewed, p: data.landingFunnel.visitors > 0 ? Math.round((data.landingFunnel.formViewed / data.landingFunnel.visitors) * 100) : 0 },
                                    { l: "✍️ Điền form", v: data.landingFunnel.formFocused, p: data.landingFunnel.visitors > 0 ? Math.round((data.landingFunnel.formFocused / data.landingFunnel.visitors) * 100) : 0 },
                                    { l: "✅ Gửi form", v: data.landingFunnel.formSubmitted, p: data.landingFunnel.visitors > 0 ? Math.round((data.landingFunnel.formSubmitted / data.landingFunnel.visitors) * 100) : 0 },
                                    { l: "📞 Gọi điện", v: data.landingFunnel.phoneCalls, p: data.landingFunnel.visitors > 0 ? Math.round((data.landingFunnel.phoneCalls / data.landingFunnel.visitors) * 100) : 0 },
                                    { l: "💬 Nhắn Zalo", v: data.landingFunnel.zaloClicks, p: data.landingFunnel.visitors > 0 ? Math.round((data.landingFunnel.zaloClicks / data.landingFunnel.visitors) * 100) : 0 },
                                ].filter(s => s.v > 0 || s.l.includes("Truy cập")).map(s => (
                                    <div key={s.l} className="flex items-center gap-3">
                                        <span className="text-xs text-zinc-600 w-28 shrink-0">{s.l}</span>
                                        <div className="flex-1 h-4 bg-white/60 rounded-full overflow-hidden"><div className="h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-500 transition-all duration-700" style={{ width: `${s.p}%` }} /></div>
                                        <span className="text-xs font-bold text-amber-700 w-8 text-right">{s.v}</span>
                                        <span className="text-xs text-zinc-400 w-10 text-right">{s.p}%</span>
                                    </div>
                                ))}
                            </div>
                            {/* Top sections */}
                            {data.siteSpecificStats?.landing?.topSections && data.siteSpecificStats.landing.topSections.length > 0 ? (
                                <div className="rounded-xl bg-white p-3 border border-amber-100">
                                    <p className="text-xs font-bold uppercase tracking-wide text-zinc-500 mb-2">📐 Section xem nhiều nhất</p>
                                    {data.siteSpecificStats.landing.topSections.map((s, i) => (
                                        <div key={s.name} className="flex items-center gap-2 text-xs py-1 border-b border-zinc-50 last:border-0">
                                            <span className="text-zinc-400 w-5 text-right font-bold">{i + 1}.</span>
                                            <span className="flex-1 text-zinc-700 font-medium truncate">{s.name}</span>
                                            <span className="font-bold text-amber-600">{s.count} lượt</span>
                                        </div>
                                    ))}
                                </div>
                            ) : null}
                        </div>
                    ) : null}

                    {/* ═══════════════════════════════════════════════════ */}
                    {/* ── Common sections ── */}
                    {/* ═══════════════════════════════════════════════════ */}

                    {/* ── Site Breakdown + Hourly ── */}
                    <div className="grid gap-4 lg:grid-cols-2">
                        {activeTab === "all" ? (
                            <div className="rounded-2xl border border-zinc-200/60 bg-white p-4">
                                <p className="text-xs font-bold uppercase tracking-wide text-zinc-500 mb-3">Lượt xem theo site</p>
                                <div className="space-y-2">
                                    {Object.entries(data.siteBreakdown).sort((a, b) => b[1] - a[1]).map(([site, count]) => {
                                        const max = Math.max(...Object.values(data.siteBreakdown), 1);
                                        const names: Record<string, string> = { mophong: "🚗 Mô Phỏng", taplai: "📚 Lý Thuyết", landing: "🌐 Landing" };
                                        const colors: Record<string, string> = { mophong: "bg-blue-500", taplai: "bg-violet-500", landing: "bg-amber-500" };
                                        return (
                                            <div key={site} className="flex items-center gap-3">
                                                <span className="text-xs font-medium text-zinc-600 w-24">{names[site] || site}</span>
                                                <div className="flex-1 h-5 bg-zinc-100 rounded-full overflow-hidden"><div className={`h-full rounded-full transition-all ${colors[site] || "bg-zinc-400"}`} style={{ width: `${Math.round((count / max) * 100)}%` }} /></div>
                                                <span className="text-sm font-bold text-zinc-700 w-12 text-right">{count}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        ) : null}
                        <div className={`rounded-2xl border border-zinc-200/60 bg-white p-4 ${activeTab !== "all" ? "lg:col-span-2" : ""}`}>
                            <p className="text-xs font-bold uppercase tracking-wide text-zinc-500 mb-3">Lượt xem theo giờ <span className="text-teal-600">(cao điểm: {data.peakHour}h)</span></p>
                            <div className="flex items-end gap-0.5 h-24">
                                {data.hourlyTraffic.map((count, h) => {
                                    const max = Math.max(...data.hourlyTraffic, 1);
                                    const pct = Math.max(3, Math.round((count / max) * 100));
                                    return (
                                        <div key={h} className="flex-1 group relative">
                                            <div className={`w-full rounded-t transition-all cursor-pointer ${h === data.peakHour ? "bg-gradient-to-t from-orange-500 to-amber-400" : "bg-gradient-to-t from-cyan-500 to-teal-400 hover:from-cyan-600"}`} style={{ height: `${pct}%` }} title={`${h}h: ${count} lượt`} />
                                            {h % 3 === 0 ? <span className="text-[9px] text-zinc-400 block text-center mt-0.5">{h}h</span> : null}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    {/* ── Entry + Exit Pages ── */}
                    <div className="grid gap-4 lg:grid-cols-2">
                        <div className="rounded-2xl border border-zinc-200/60 bg-white p-4">
                            <p className="text-xs font-bold uppercase tracking-wide text-zinc-500 mb-3">🚪 Trang vào đầu tiên</p>
                            <div className="space-y-1.5">
                                {data.topEntryPages.map((p, i) => (
                                    <div key={p.page} className="flex items-center gap-2 text-xs"><span className="text-zinc-400 w-5 text-right font-bold">{i + 1}.</span><span className="flex-1 text-zinc-700 font-medium truncate">{p.page}</span><span className="font-bold text-teal-600">{p.count}</span></div>
                                ))}
                                {data.topEntryPages.length === 0 ? <p className="text-xs text-zinc-400">Chưa có dữ liệu</p> : null}
                            </div>
                        </div>
                        <div className="rounded-2xl border border-zinc-200/60 bg-white p-4">
                            <p className="text-xs font-bold uppercase tracking-wide text-zinc-500 mb-3">🚶 Trang thoát cuối</p>
                            <div className="space-y-1.5">
                                {data.topExitPages.map((p, i) => (
                                    <div key={p.page} className="flex items-center gap-2 text-xs"><span className="text-zinc-400 w-5 text-right font-bold">{i + 1}.</span><span className="flex-1 text-zinc-700 font-medium truncate">{p.page}</span><span className="font-bold text-rose-500">{p.count}</span></div>
                                ))}
                                {data.topExitPages.length === 0 ? <p className="text-xs text-zinc-400">Chưa có dữ liệu</p> : null}
                            </div>
                        </div>
                    </div>

                    {/* ── Top Pages ── */}
                    <div className="rounded-2xl border border-zinc-200/60 bg-white p-4">
                        <p className="text-xs font-bold uppercase tracking-wide text-zinc-500 mb-3">📊 Top 10 trang truy cập</p>
                        <div className="space-y-1.5">
                            {data.topPages.map((p, i) => (
                                <div key={p.page} className="flex items-center gap-2 text-xs">
                                    <span className="text-zinc-400 w-5 text-right font-bold">{i + 1}.</span>
                                    <span className="flex-1 text-zinc-700 font-medium truncate">{p.page}</span>
                                    <div className="w-20 h-2.5 bg-zinc-100 rounded-full overflow-hidden"><div className="h-full bg-cyan-400 rounded-full" style={{ width: `${p.pct}%` }} /></div>
                                    <span className="font-bold text-cyan-600 w-10 text-right">{p.count}</span>
                                    <span className="text-zinc-400 w-10 text-right">{p.pct}%</span>
                                </div>
                            ))}
                            {data.topPages.length === 0 ? <p className="text-xs text-zinc-400">Chưa có dữ liệu</p> : null}
                        </div>
                    </div>

                    {/* ── Screen sizes + Referrers ── */}
                    <div className="grid gap-4 lg:grid-cols-2">
                        {Object.keys(data.screenSizes).length > 0 ? (
                            <div className="rounded-2xl border border-zinc-200/60 bg-white p-4">
                                <p className="text-xs font-bold uppercase tracking-wide text-zinc-500 mb-3">📐 Kích thước màn hình</p>
                                <div className="space-y-2">{Object.entries(data.screenSizes).sort((a, b) => b[1] - a[1]).map(([label, count]) => (
                                    <div key={label} className="flex items-center justify-between text-sm"><span className="text-zinc-600">{label}</span><span className="font-bold text-zinc-700">{count} phiên</span></div>
                                ))}</div>
                            </div>
                        ) : null}
                        {data.topReferrers.length > 0 ? (
                            <div className="rounded-2xl border border-zinc-200/60 bg-white p-4">
                                <p className="text-xs font-bold uppercase tracking-wide text-zinc-500 mb-3">🔗 Nguồn truy cập</p>
                                <div className="space-y-2">{data.topReferrers.map((r) => (
                                    <div key={r.source} className="flex items-center justify-between text-sm"><span className="text-zinc-600 truncate">{r.source}</span><span className="font-bold text-violet-600">{r.count} lượt</span></div>
                                ))}</div>
                            </div>
                        ) : null}
                    </div>

                    {/* ── AI Analysis ── */}
                    <div className="rounded-2xl border border-violet-200/60 bg-gradient-to-br from-violet-50 via-white to-indigo-50 p-5">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 text-white text-lg shadow-md">🤖</div>
                                <div><p className="text-sm font-bold text-zinc-700">Phân tích AI chi tiết</p><p className="text-xs text-zinc-500">OpenAI GPT-4o-mini phân tích hành vi & gợi ý</p></div>
                            </div>
                            <button type="button" disabled={aiLoading} onClick={runAi} className="rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:from-violet-700 hover:to-indigo-700 disabled:opacity-50 shadow-md">
                                {aiLoading ? <span className="inline-flex items-center gap-1.5"><Spinner /> Đang phân tích...</span> : "🔍 Phân tích AI"}
                            </button>
                        </div>
                        {aiReport ? (
                            <div className="prose prose-sm max-w-none text-zinc-700 whitespace-pre-wrap leading-relaxed bg-white/60 rounded-xl p-4 border border-violet-100">{aiReport}</div>
                        ) : (
                            <p className="text-sm text-zinc-400">Nhấn &quot;Phân tích AI&quot; để AI phân tích hành vi ngày {selectedDate}.</p>
                        )}
                    </div>
                </>
            ) : null}
        </div>
    );
}
