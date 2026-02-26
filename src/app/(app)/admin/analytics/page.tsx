"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { fetchJson } from "@/lib/api-client";
import { getToken } from "@/lib/auth-client";
import { Spinner } from "@/components/ui/spinner";

/* ── Types ─────────────────────────────────────────────────── */
type NameCount = { name: string; count: number };
type DailyTrend = { date: string; views: number; sessions: number; users: number };
type RetentionData = {
    averageRetention: { d1: number; d3: number; d7: number };
    dailyRetention: Array<{ date: string; totalUsers: number; d1: number; d3: number; d7: number; d1Rate: number; d3Rate: number; d7Rate: number }>;
};
type AnalyticsData = {
    date: string;
    range: number;
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
    topUserFlows: Array<{ flow: string; count: number; steps: number }>;
    dropoffRates: Array<{ page: string; total: number; exits: number; dropoffRate: number }>;
    timeOnPage: Array<{ page: string; avgSeconds: number; samples: number }>;
    landingFunnel: {
        visitors: number; pricingViewed: number; ctaClicks: number;
        formViewed: number; formFocused: number; formSubmitted: number;
        formClicks: number; phoneCalls: number; zaloClicks: number;
        totalLeads: number;
    };
    conversionRate: number;
    siteSpecificStats: {
        mophong?: { topScenarios: NameCount[]; topVideos: NameCount[]; examStarts: number; examFinishes: number; examCompletionRate: number; totalBrakes: number };
        taplai?: { topTopics: NameCount[]; topSearches: NameCount[]; totalAnswers: number; correctAnswers: number; correctRate: number; dailyPractices: number; wrongReviews: number };
        landing?: { topSections: NameCount[]; funnelDetail: AnalyticsData["landingFunnel"]; conversionRate: number };
    };
    // v3 additions
    dailyTrend: DailyTrend[];
    avgPerf: { ttfb: number; domReady: number; load: number; samples: number } | null;
    errorCount: number;
    topUtmSources: Array<{ source: string; count: number }>;
    activeUsers: number;
    insights: string[];
};

type SiteTab = "all" | "mophong" | "taplai" | "landing";
const TABS: { key: SiteTab; label: string; icon: string; color: string; active: string }[] = [
    { key: "all", label: "Tất cả", icon: "🌍", color: "text-zinc-600", active: "bg-zinc-800 text-white" },
    { key: "mophong", label: "Mô Phỏng", icon: "🚗", color: "text-blue-600", active: "bg-blue-600 text-white" },
    { key: "taplai", label: "Lý Thuyết", icon: "📚", color: "text-violet-600", active: "bg-violet-600 text-white" },
    { key: "landing", label: "Landing", icon: "🌐", color: "text-amber-600", active: "bg-amber-600 text-white" },
];

const RANGE_OPTIONS = [
    { value: 1, label: "Hôm nay" },
    { value: 7, label: "7 ngày" },
    { value: 30, label: "30 ngày" },
];

function fmtDuration(s: number) { return s > 60 ? `${Math.floor(s / 60)}p${s % 60}s` : `${s}s`; }
function changeBadge(v: number) { return v >= 0 ? `📈 +${v}%` : `📉 ${v}%`; }

/* ── Simple Bar Chart ──────────────────────────────────────── */
function BarChart({ data, color = "from-cyan-500 to-teal-400" }: { data: { label: string; value: number }[]; color?: string }) {
    const max = Math.max(...data.map(d => d.value), 1);
    return (
        <div className="flex items-end gap-0.5 h-24">
            {data.map((d, i) => {
                const pct = Math.max(3, Math.round((d.value / max) * 100));
                return (
                    <div key={i} className="flex-1 group relative">
                        <div className={`w-full rounded-t transition-all cursor-pointer bg-gradient-to-t ${color}`} style={{ height: `${pct}%` }} title={`${d.label}: ${d.value}`} />
                        {i % Math.max(1, Math.floor(data.length / 8)) === 0 ? <span className="text-[9px] text-zinc-400 block text-center mt-0.5">{d.label}</span> : null}
                    </div>
                );
            })}
        </div>
    );
}

/* ── Page ──────────────────────────────────────────────────── */
export default function AnalyticsPage() {
    const today = new Date().toISOString().slice(0, 10);
    const [selectedDate, setSelectedDate] = useState(today);
    const [selectedRange, setSelectedRange] = useState(1);
    const [activeTab, setActiveTab] = useState<SiteTab>("all");
    const [data, setData] = useState<AnalyticsData | null>(null);
    const [retention, setRetention] = useState<RetentionData | null>(null);
    const [loading, setLoading] = useState(false);
    const [aiReport, setAiReport] = useState<string | null>(null);
    const [aiLoading, setAiLoading] = useState(false);
    const [error, setError] = useState("");
    const [autoRefresh, setAutoRefresh] = useState(false);
    const intervalRef = useRef<NodeJS.Timeout | null>(null);
    // AI Chatbot state
    const [chatOpen, setChatOpen] = useState(false);
    const [chatInput, setChatInput] = useState("");
    const [chatLoading, setChatLoading] = useState(false);
    const [chatHistory, setChatHistory] = useState<Array<{ role: "user" | "ai"; text: string }>>([
        { role: "ai", text: "Xin chào! Tôi là trợ lý AI analytics. Hãy hỏi bất kỳ câu hỏi nào về dữ liệu của bạn \ud83d\ude0a" },
    ]);
    // Auto-Insights state
    type InsightItem = { id: string; date: string; type: string; title: string; content: string; severity?: string; read: boolean; createdAt: string };
    const [insights, setInsights] = useState<InsightItem[]>([]);
    const [insightsUnread, setInsightsUnread] = useState(0);
    const [showInsights, setShowInsights] = useState(false);
    // Phase 3 state
    type RealtimeData = { activeUsers: number; activeSessions: number; activeInLastMin: number; eventStream: Array<{ type: string; page: string; site: string; ago: number }>; topActivePages: Array<{ page: string; views: number }>; sparkline: number[]; totalLast30Min: number };
    type CohortRow = { cohortWeek: string; totalUsers: number; retention: number[] };
    type GeoCountry = { country: string; sessions: number; pageViews: number; users: number; pct: number };
    type GeoProvince = { province: string; sessions: number; pageViews: number; users: number; pct: number };
    type AttrRow = { source: string; medium: string; sessions: number; conversions: number; conversionRate: number; types: Record<string, number> };
    const [realtime, setRealtime] = useState<RealtimeData | null>(null);
    const [cohort, setCohort] = useState<CohortRow[]>([]);
    const [geoData, setGeoData] = useState<GeoCountry[]>([]);
    const [provinceData, setProvinceData] = useState<GeoProvince[]>([]);
    const [attribution, setAttribution] = useState<{ rows: AttrRow[]; overallRate: number; siteConversions: Record<string, { total: number; conversions: number; rate: number }> } | null>(null);
    const [showCohort, setShowCohort] = useState(false);
    const [showGeo, setShowGeo] = useState(false);
    const [showAttribution, setShowAttribution] = useState(false);
    // Phase 4 state
    type GoalItem = { id: string; name: string; metric: string; target: number; period: string; site?: string | null; current: number; pct: number; periodLabel: string };
    const [goals, setGoals] = useState<GoalItem[]>([]);
    const [showGoalForm, setShowGoalForm] = useState(false);
    const [goalForm, setGoalForm] = useState({ name: "", metric: "page_views", target: "100", period: "daily", site: "" });
    const [digestLoading, setDigestLoading] = useState(false);
    // Dashboard customization — stored in localStorage
    type WidgetVisibility = { realtime: boolean; cohort: boolean; geo: boolean; attribution: boolean; goals: boolean; insights: boolean; chatbot: boolean };
    const defaultWidgets: WidgetVisibility = { realtime: true, cohort: true, geo: true, attribution: true, goals: true, insights: true, chatbot: true };
    const [widgets, setWidgets] = useState<WidgetVisibility>(() => {
        if (typeof window !== "undefined") { try { const s = localStorage.getItem("_td_widgets"); if (s) return JSON.parse(s); } catch { } }
        return defaultWidgets;
    });
    const [showSettings, setShowSettings] = useState(false);
    const toggleWidget = (key: keyof WidgetVisibility) => {
        setWidgets(prev => { const next = { ...prev, [key]: !prev[key] }; if (typeof window !== "undefined") localStorage.setItem("_td_widgets", JSON.stringify(next)); return next; });
    };

    const loadData = useCallback(async (date: string, site: SiteTab, range: number) => {
        setLoading(true); setError(""); setAiReport(null);
        try {
            const token = getToken(); if (!token) return;
            const siteParam = site === "all" ? "" : `&site=${site}`;
            const result = await fetchJson<AnalyticsData>(`/api/analytics/dashboard?date=${date}&range=${range}${siteParam}`, { token });
            setData(result);
        } catch (e) { setError(e instanceof Error ? e.message : "Không thể tải dữ liệu"); } finally { setLoading(false); }
    }, []);

    const loadRetention = useCallback(async (site: SiteTab) => {
        try {
            const token = getToken(); if (!token) return;
            const siteParam = site === "all" ? "" : `?site=${site}`;
            const result = await fetchJson<RetentionData>(`/api/analytics/retention${siteParam}`, { token });
            setRetention(result);
        } catch { /* ignore */ }
    }, []);

    useEffect(() => { loadData(selectedDate, activeTab, selectedRange); loadRetention(activeTab); }, [selectedDate, activeTab, selectedRange, loadData, loadRetention]);

    // Load auto-insights on mount
    useEffect(() => {
        (async () => {
            try {
                const token = getToken(); if (!token) return;
                const res = await fetchJson<{ insights: InsightItem[]; unreadCount: number }>("/api/analytics/auto-insights?limit=5", { token });
                setInsights(res.insights);
                setInsightsUnread(res.unreadCount);
            } catch { /* ignore */ }
        })();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Load Phase 3 data
    useEffect(() => {
        const loadAdvanced = async () => {
            const token = getToken(); if (!token) return;
            const siteParam = activeTab === "all" ? "" : `&site=${activeTab}`;
            try {
                const [rt, co, geo, attr] = await Promise.all([
                    fetchJson<RealtimeData>(`/api/analytics/realtime?${siteParam.replace('&', '')}`, { token }),
                    fetchJson<{ cohortData: CohortRow[] }>(`/api/analytics/cohort?weeks=8${siteParam}`, { token }),
                    fetchJson<{ countries: GeoCountry[]; provinces: GeoProvince[] }>(`/api/analytics/geo?range=${selectedRange}${siteParam}`, { token }),
                    fetchJson<{ attribution: AttrRow[]; overallRate: number; siteConversions: Record<string, { total: number; conversions: number; rate: number }> }>(`/api/analytics/attribution?range=${selectedRange}`, { token }),
                ]);
                setRealtime(rt);
                setCohort(co.cohortData);
                setGeoData(geo.countries);
                setProvinceData(geo.provinces || []);
                setAttribution({ rows: attr.attribution, overallRate: attr.overallRate, siteConversions: attr.siteConversions });
            } catch { /* ignore */ }
        };
        loadAdvanced();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeTab, selectedRange]);

    // Load Goals
    useEffect(() => {
        const loadGoals = async () => {
            const token = getToken(); if (!token) return;
            try {
                const res = await fetchJson<{ goals: GoalItem[] }>("/api/analytics/goals", { token });
                setGoals(res.goals);
            } catch { /* ignore */ }
        };
        loadGoals();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const createGoal = async () => {
        const token = getToken(); if (!token) return;
        try {
            await fetchJson("/api/analytics/goals", { token, method: "POST", body: { ...goalForm, target: parseInt(goalForm.target) || 100, site: goalForm.site || null } });
            setShowGoalForm(false); setGoalForm({ name: "", metric: "page_views", target: "100", period: "daily", site: "" });
            const res = await fetchJson<{ goals: GoalItem[] }>("/api/analytics/goals", { token });
            setGoals(res.goals);
        } catch { /* ignore */ }
    };

    const deleteGoal = async (id: string) => {
        const token = getToken(); if (!token) return;
        try {
            await fetchJson(`/api/analytics/goals?id=${id}`, { token, method: "DELETE" });
            setGoals(g => g.filter(x => x.id !== id));
        } catch { /* ignore */ }
    };

    const generateDigest = async () => {
        const token = getToken(); if (!token) return;
        setDigestLoading(true);
        try {
            await fetchJson("/api/analytics/email-report", { token, method: "POST" });
            alert("✅ Đã tạo Email Digest! Xem trong Auto-Insights.");
        } catch { alert("Lỗi tạo digest"); } finally { setDigestLoading(false); }
    };

    // Auto-refresh every 30s
    useEffect(() => {
        if (autoRefresh) {
            intervalRef.current = setInterval(() => { loadData(selectedDate, activeTab, selectedRange); }, 30000);
        }
        return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
    }, [autoRefresh, selectedDate, activeTab, selectedRange, loadData]);

    const runAi = async () => {
        const token = getToken(); if (!token) return;
        setAiLoading(true); setAiReport(null);
        try {
            const siteParam = activeTab === "all" ? "" : `&site=${activeTab}`;
            const res = await fetchJson<{ analysis: string }>(`/api/analytics/ai-report?date=${selectedDate}&range=${selectedRange}${siteParam}`, { token, method: "POST" });
            setAiReport(res.analysis);
        } catch { setAiReport("Không thể tạo báo cáo AI."); } finally { setAiLoading(false); }
    };

    const exportCSV = async () => {
        const token = getToken(); if (!token) return;
        const siteParam = activeTab === "all" ? "" : `&site=${activeTab}`;
        window.open(`/api/analytics/export?date=${selectedDate}&range=${selectedRange}${siteParam}&token=${token}`, "_blank");
    };

    const sendChat = async () => {
        if (!chatInput.trim() || chatLoading) return;
        const q = chatInput.trim();
        setChatInput("");
        setChatHistory(h => [...h, { role: "user", text: q }]);
        setChatLoading(true);
        try {
            const token = getToken(); if (!token) return;
            const siteParam = activeTab === "all" ? undefined : activeTab;
            const res = await fetchJson<{ answer: string }>("/api/analytics/ai-chat", {
                token, method: "POST",
                body: JSON.stringify({ question: q, site: siteParam, range: selectedRange || 7 }),
            });
            setChatHistory(h => [...h, { role: "ai", text: res.answer }]);
        } catch {
            setChatHistory(h => [...h, { role: "ai", text: "Xin lỗi, không thể trả lời câu hỏi này." }]);
        } finally { setChatLoading(false); }
    };

    const generateAutoInsight = async () => {
        try {
            const token = getToken(); if (!token) return;
            setAiLoading(true);
            await fetchJson("/api/analytics/auto-insights", { token, method: "POST" });
            const res = await fetchJson<{ insights: InsightItem[]; unreadCount: number }>("/api/analytics/auto-insights?limit=5", { token });
            setInsights(res.insights);
            setInsightsUnread(res.unreadCount);
        } catch { /* ignore */ } finally { setAiLoading(false); }
    };

    return (
        <div className="space-y-4">
            {/* ── Header ── */}
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h1 className="text-lg sm:text-xl font-bold text-zinc-800">📈 Phân tích truy cập</h1>
                    <p className="text-xs sm:text-sm text-zinc-500">Theo dõi người dùng, hành vi và chuyển đổi</p>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                    <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} max={today}
                        className="rounded-xl border border-zinc-200 bg-white px-2 py-1.5 text-xs sm:text-sm shadow-sm focus:border-blue-400 focus:ring-2 focus:ring-blue-100 w-[130px]" />
                    {/* Range selector */}
                    <div className="flex gap-0.5 rounded-xl border border-zinc-200 bg-zinc-50 p-0.5">
                        {RANGE_OPTIONS.map(r => (
                            <button key={r.value} type="button" onClick={() => setSelectedRange(r.value)}
                                className={`rounded-lg px-2 py-1 text-[11px] sm:text-xs font-medium transition-all ${selectedRange === r.value ? "bg-white text-zinc-800 shadow-sm" : "text-zinc-500 hover:text-zinc-700"}`}>
                                {r.label}
                            </button>
                        ))}
                    </div>
                    {/* Auto-refresh toggle */}
                    <button type="button" onClick={() => setAutoRefresh(!autoRefresh)}
                        className={`rounded-xl border px-2 py-1.5 text-[11px] sm:text-xs font-medium transition-all ${autoRefresh ? "border-green-300 bg-green-50 text-green-700" : "border-zinc-200 bg-white text-zinc-500 hover:bg-zinc-50"}`}>
                        {autoRefresh ? "⏸️ Tự động" : "▶️ Tự động"}
                    </button>
                    <button type="button" onClick={exportCSV}
                        className="rounded-xl border border-zinc-200 bg-white px-2 py-1.5 text-[11px] sm:text-xs font-medium text-zinc-600 hover:bg-zinc-50">📥 CSV</button>
                    <button type="button" onClick={() => loadData(selectedDate, activeTab, selectedRange)} disabled={loading}
                        className="rounded-xl bg-blue-600 px-2 py-1.5 text-[11px] sm:text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50 shadow-sm">
                        {loading ? <Spinner /> : "🔄 Tải lại"}
                    </button>
                </div>
            </div>

            {/* ── Tab Bar ── */}
            <div className="flex gap-1 sm:gap-1.5 rounded-2xl bg-zinc-100/80 p-1 sm:p-1.5 overflow-x-auto">
                {TABS.map(tab => (
                    <button key={tab.key} type="button" onClick={() => setActiveTab(tab.key)}
                        className={`flex items-center gap-1 sm:gap-1.5 rounded-xl px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium transition-all duration-200 whitespace-nowrap ${activeTab === tab.key ? `${tab.active} shadow-md` : `bg-white/60 ${tab.color} hover:bg-white hover:shadow-sm`}`}>
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

                    {/* ── 7 Overview Cards (6 original + active users) ── */}
                    <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4 xl:grid-cols-7">
                        {[
                            { icon: "🟢", label: "Đang online", val: data.activeUsers, sub: "Phiên 5 phút qua", color: "border-green-300 from-green-50 to-emerald-100/30" },
                            { icon: "👤", label: "Người dùng", val: data.realUsers, sub: `🆕 ${data.newUsers} mới · 🔄 ${data.returningUsers}`, color: "border-blue-200 from-blue-50 to-blue-100/30" },
                            { icon: "👁️", label: "Lượt xem", val: data.totalPageViews, sub: `${changeBadge(data.viewsChange)} vs trước (${data.yesterdayPageViews})`, color: "border-indigo-200 from-indigo-50 to-indigo-100/30" },
                            { icon: "📊", label: "Phiên", val: data.uniqueSessions, sub: `${changeBadge(data.sessionsChange)} vs trước (${data.yesterdaySessions})`, color: "border-violet-200 from-violet-50 to-violet-100/30" },
                            { icon: "⏱️", label: "Thời gian TB", val: fmtDuration(data.avgDuration), sub: `${data.avgPagesPerSession} trang/phiên`, color: "border-amber-200 from-amber-50 to-amber-100/30" },
                            { icon: "🎯", label: "Tương tác", val: `${data.engagementRate}%`, sub: `Thoát: ${data.bounceRate}%`, color: "border-emerald-200 from-emerald-50 to-emerald-100/30" },
                            { icon: "📱", label: "Di động", val: `${data.deviceBreakdown.mobilePercent}%`, sub: `📱 ${data.deviceBreakdown.mobile} · 💻 ${data.deviceBreakdown.desktop}`, color: "border-cyan-200 from-cyan-50 to-cyan-100/30" },
                        ].map(c => (
                            <div key={c.label} className={`rounded-xl sm:rounded-2xl border ${c.color} bg-gradient-to-br p-3 sm:p-4 transition-all hover:shadow-lg`}>
                                <div className="flex items-center gap-1 mb-0.5 sm:mb-1"><span className="text-base sm:text-lg">{c.icon}</span><p className="text-[10px] sm:text-[11px] uppercase tracking-wide text-zinc-500">{c.label}</p></div>
                                <p className="text-xl sm:text-2xl font-bold text-zinc-800">{c.val}</p>
                                <p className="text-[10px] sm:text-[11px] text-zinc-500 mt-0.5 sm:mt-1 truncate">{c.sub}</p>
                            </div>
                        ))}
                    </div>

                    {/* ── Daily Trend Chart (only for range > 1) ── */}
                    {data.dailyTrend.length > 0 ? (
                        <div className="rounded-2xl border border-zinc-200/60 bg-white p-4">
                            <p className="text-xs font-bold uppercase tracking-wide text-zinc-500 mb-3">📊 Xu hướng {selectedRange} ngày</p>
                            <BarChart data={data.dailyTrend.map(d => ({ label: d.date.slice(5), value: d.views }))} color="from-blue-500 to-indigo-400" />
                            <div className="flex gap-4 mt-2 text-[11px] text-zinc-400">
                                <span>📊 Lượt xem</span>
                                <span>Tổng: {data.dailyTrend.reduce((s, d) => s + d.views, 0)} views</span>
                                <span>TB: {Math.round(data.dailyTrend.reduce((s, d) => s + d.views, 0) / data.dailyTrend.length)}/ngày</span>
                            </div>
                        </div>
                    ) : null}

                    {/* ── Performance + Errors + UTM (3-col) ── */}
                    <div className="grid gap-3 lg:grid-cols-3">
                        {/* Perf metrics */}
                        <div className="rounded-2xl border border-zinc-200/60 bg-white p-4">
                            <p className="text-xs font-bold uppercase tracking-wide text-zinc-500 mb-3">⚡ Hiệu năng trang</p>
                            {data.avgPerf ? (
                                <div className="space-y-2">
                                    {[
                                        { l: "TTFB", v: data.avgPerf.ttfb, u: "ms", g: 200 },
                                        { l: "DOM sẵn sàng", v: data.avgPerf.domReady, u: "ms", g: 1500 },
                                        { l: "Tải xong", v: data.avgPerf.load, u: "ms", g: 3000 },
                                    ].map(m => (
                                        <div key={m.l} className="flex items-center justify-between text-sm">
                                            <span className="text-zinc-600">{m.l}</span>
                                            <span className={`font-bold ${m.v <= m.g ? "text-green-600" : m.v <= m.g * 2 ? "text-amber-600" : "text-red-500"}`}>{m.v}{m.u}</span>
                                        </div>
                                    ))}
                                    <p className="text-[11px] text-zinc-400 mt-1">{data.avgPerf.samples} mẫu đo</p>
                                </div>
                            ) : <p className="text-xs text-zinc-400">Chưa có dữ liệu perf</p>}
                        </div>

                        {/* Errors */}
                        <div className="rounded-2xl border border-zinc-200/60 bg-white p-4">
                            <p className="text-xs font-bold uppercase tracking-wide text-zinc-500 mb-3">🐛 Lỗi JavaScript</p>
                            <p className={`text-3xl font-bold ${data.errorCount > 0 ? "text-red-500" : "text-green-600"}`}>{data.errorCount}</p>
                            <p className="text-xs text-zinc-400 mt-1">{data.errorCount === 0 ? "Không có lỗi 🎉" : "Cần kiểm tra console"}</p>
                        </div>

                        {/* UTM Sources */}
                        <div className="rounded-2xl border border-zinc-200/60 bg-white p-4">
                            <p className="text-xs font-bold uppercase tracking-wide text-zinc-500 mb-3">📣 Nguồn UTM</p>
                            {data.topUtmSources.length > 0 ? (
                                <div className="space-y-1.5">
                                    {data.topUtmSources.slice(0, 5).map((u, i) => (
                                        <div key={u.source} className="flex items-center gap-2 text-xs">
                                            <span className="text-zinc-400 w-4 text-right font-bold">{i + 1}.</span>
                                            <span className="flex-1 text-zinc-700 font-medium truncate">{u.source}</span>
                                            <span className="font-bold text-indigo-600">{u.count}</span>
                                        </div>
                                    ))}
                                </div>
                            ) : <p className="text-xs text-zinc-400">Chưa có traffic từ UTM</p>}
                        </div>
                    </div>

                    {/* ── Retention ── */}
                    {retention ? (
                        <div className="rounded-2xl border border-teal-200/60 bg-gradient-to-br from-teal-50 via-white to-cyan-50 p-4">
                            <p className="text-xs font-bold uppercase tracking-wide text-teal-700 mb-3">📈 Tỷ lệ quay lại — 30 ngày</p>
                            <div className="grid gap-3 sm:grid-cols-3 mb-4">
                                {[
                                    { l: "Ngày +1", v: retention.averageRetention.d1 },
                                    { l: "Ngày +3", v: retention.averageRetention.d3 },
                                    { l: "Ngày +7", v: retention.averageRetention.d7 },
                                ].map(r => (
                                    <div key={r.l} className="rounded-xl bg-white p-3 border border-teal-100 text-center">
                                        <p className={`text-2xl font-bold ${r.v >= 30 ? "text-green-600" : r.v >= 15 ? "text-amber-600" : "text-red-500"}`}>{r.v}%</p>
                                        <p className="text-xs text-zinc-500">{r.l}</p>
                                    </div>
                                ))}
                            </div>
                            {retention.dailyRetention.length > 0 ? (
                                <BarChart data={retention.dailyRetention.map(d => ({ label: d.date.slice(5), value: d.d1Rate }))} color="from-teal-500 to-cyan-400" />
                            ) : null}
                        </div>
                    ) : null}

                    {/* ═══════ Site-specific sections ═══════ */}

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
                            <div className="space-y-2 mb-4">
                                {[
                                    { l: "👁️ Truy cập", v: data.landingFunnel.visitors, p: 100 },
                                    { l: "💰 Xem bảng giá", v: data.landingFunnel.pricingViewed, p: data.landingFunnel.visitors > 0 ? Math.round((data.landingFunnel.pricingViewed / data.landingFunnel.visitors) * 100) : 0 },
                                    { l: "🔔 CTA clicks", v: data.landingFunnel.ctaClicks, p: data.landingFunnel.visitors > 0 ? Math.round((data.landingFunnel.ctaClicks / data.landingFunnel.visitors) * 100) : 0 },
                                    { l: "📋 Mở form", v: data.landingFunnel.formViewed, p: data.landingFunnel.visitors > 0 ? Math.round((data.landingFunnel.formViewed / data.landingFunnel.visitors) * 100) : 0 },
                                    { l: "✍️ Điền form", v: data.landingFunnel.formFocused, p: data.landingFunnel.visitors > 0 ? Math.round((data.landingFunnel.formFocused / data.landingFunnel.visitors) * 100) : 0 },
                                    { l: "🖱️ Bấm gửi form", v: data.landingFunnel.formClicks || 0, p: data.landingFunnel.visitors > 0 ? Math.round(((data.landingFunnel.formClicks || 0) / data.landingFunnel.visitors) * 100) : 0 },
                                    { l: "✅ Leads mới (DB)", v: data.landingFunnel.formSubmitted, p: data.landingFunnel.visitors > 0 ? Math.round((data.landingFunnel.formSubmitted / data.landingFunnel.visitors) * 100) : 0 },
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

                    {/* ═══════ Common sections ═══════ */}

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
                            <BarChart data={data.hourlyTraffic.map((count, h) => ({ label: `${h}h`, value: count }))} />
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

                    {/* ── User Flows ── */}
                    {data.topUserFlows?.length > 0 ? (
                        <div className="rounded-2xl border-2 border-cyan-200/60 bg-gradient-to-br from-cyan-50 via-white to-sky-50 p-5">
                            <p className="text-base font-bold text-cyan-800 mb-4">🛤️ Hành trình người dùng</p>
                            <div className="space-y-2">
                                {data.topUserFlows.map((f, i) => (
                                    <div key={f.flow} className="rounded-xl bg-white p-3 border border-cyan-100 flex items-start gap-3">
                                        <span className="text-sm font-bold text-cyan-600 w-6 shrink-0 mt-0.5">#{i + 1}</span>
                                        <div className="flex-1">
                                            <div className="flex flex-wrap items-center gap-1 text-xs">
                                                {f.flow.split(" → ").map((step, j, arr) => (
                                                    <span key={j} className="flex items-center gap-1">
                                                        <span className="bg-cyan-100 text-cyan-800 px-2 py-0.5 rounded-md font-medium">{step}</span>
                                                        {j < arr.length - 1 ? <span className="text-cyan-400">→</span> : null}
                                                    </span>
                                                ))}
                                            </div>
                                            <p className="text-xs text-zinc-400 mt-1">{f.steps} bước · {f.count} phiên</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : null}

                    {/* ── Drop-off + Time-on-page ── */}
                    <div className="grid gap-4 lg:grid-cols-2">
                        {/* Drop-off */}
                        {data.dropoffRates?.length > 0 ? (
                            <div className="rounded-2xl border border-zinc-200/60 bg-white p-4">
                                <p className="text-xs font-bold uppercase tracking-wide text-zinc-500 mb-3">⚠️ Trang có tỷ lệ thoát cao nhất</p>
                                <div className="space-y-2">
                                    {data.dropoffRates.map(d => (
                                        <div key={d.page} className="flex items-center gap-3">
                                            <span className="text-xs text-zinc-600 flex-1 truncate font-medium">{d.page}</span>
                                            <div className="w-20 h-2.5 bg-zinc-100 rounded-full overflow-hidden">
                                                <div className={`h-full rounded-full ${d.dropoffRate > 70 ? "bg-red-500" : d.dropoffRate > 40 ? "bg-amber-400" : "bg-green-400"}`} style={{ width: `${d.dropoffRate}%` }} />
                                            </div>
                                            <span className={`text-xs font-bold w-12 text-right ${d.dropoffRate > 70 ? "text-red-500" : d.dropoffRate > 40 ? "text-amber-600" : "text-green-600"}`}>{d.dropoffRate}%</span>
                                            <span className="text-xs text-zinc-400 w-14 text-right">{d.exits}/{d.total}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ) : null}
                        {/* Time-on-page */}
                        {data.timeOnPage?.length > 0 ? (
                            <div className="rounded-2xl border border-zinc-200/60 bg-white p-4">
                                <p className="text-xs font-bold uppercase tracking-wide text-zinc-500 mb-3">⏱️ Thời gian trung bình mỗi trang</p>
                                <div className="space-y-2">
                                    {data.timeOnPage.map(t => {
                                        const badge = t.avgSeconds > 120 ? "🟢" : t.avgSeconds > 30 ? "🟡" : "🔴";
                                        return (
                                            <div key={t.page} className="flex items-center gap-3">
                                                <span className="text-sm">{badge}</span>
                                                <span className="text-xs text-zinc-600 flex-1 truncate font-medium">{t.page}</span>
                                                <span className="text-xs font-bold text-zinc-700">{t.avgSeconds > 60 ? `${Math.floor(t.avgSeconds / 60)}p${t.avgSeconds % 60}s` : `${t.avgSeconds}s`}</span>
                                                <span className="text-xs text-zinc-400">{t.samples} mẫu</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        ) : null}
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

                    {/* ═════ AI Hub ═════ */}

                    {/* ── Auto-Insights Panel ── */}
                    <div className="rounded-2xl border-2 border-emerald-200/60 bg-gradient-to-br from-emerald-50 via-white to-teal-50 p-5">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white text-lg shadow-md">💡</div>
                                <div>
                                    <p className="text-sm font-bold text-zinc-700 flex items-center gap-2">
                                        AI Auto-Insights
                                        {insightsUnread > 0 ? <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full font-bold">{insightsUnread} mới</span> : null}
                                    </p>
                                    <p className="text-xs text-zinc-500">Nhận dạng bất thường &amp; báo cáo hàng ngày</p>
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <button type="button" onClick={() => setShowInsights(!showInsights)} className="rounded-xl bg-white border border-emerald-200 px-3 py-2 text-xs font-medium text-emerald-700 hover:bg-emerald-50">
                                    {showInsights ? "▲ Ẩn" : `▼ Xem (${insights.length})`}
                                </button>
                                <button type="button" disabled={aiLoading} onClick={generateAutoInsight} className="rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-3 py-2 text-xs font-medium text-white hover:from-emerald-700 hover:to-teal-700 disabled:opacity-50 shadow-md">
                                    {aiLoading ? <span className="inline-flex items-center gap-1"><Spinner /> Đang chạy...</span> : "⚡ Tạo insight mới"}
                                </button>
                            </div>
                        </div>
                        {showInsights && insights.length > 0 ? (
                            <div className="space-y-3">
                                {insights.map(ins => (
                                    <div key={ins.id} className={`rounded-xl p-3 border ${ins.severity === "critical" ? "bg-red-50 border-red-200" : ins.severity === "warning" ? "bg-amber-50 border-amber-200" : "bg-white border-zinc-200"}`}>
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="text-xs font-bold text-zinc-700">{ins.title}</span>
                                            <span className="text-xs text-zinc-400">{ins.date}</span>
                                        </div>
                                        <div className="text-xs text-zinc-600 whitespace-pre-wrap leading-relaxed">{ins.content.slice(0, 300)}{ins.content.length > 300 ? "..." : ""}</div>
                                        {ins.type === "anomaly" ? <span className="inline-block mt-1 text-xs bg-amber-200 text-amber-800 px-1.5 py-0.5 rounded font-bold">⚠️ Anomaly</span> : null}
                                    </div>
                                ))}
                            </div>
                        ) : showInsights ? <p className="text-xs text-zinc-400">Chưa có insight. Nhấn "⚡ Tạo insight mới" để AI phân tích.</p> : null}
                    </div>

                    {/* ── AI Chatbot ── */}
                    <div className="rounded-2xl border-2 border-indigo-200/60 bg-gradient-to-br from-indigo-50 via-white to-purple-50 p-5">
                        <div className="flex items-center justify-between mb-4 cursor-pointer" onClick={() => setChatOpen(!chatOpen)}>
                            <div className="flex items-center gap-2">
                                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white text-lg shadow-md">💬</div>
                                <div>
                                    <p className="text-sm font-bold text-zinc-700">Hỏi AI về dữ liệu phân tích</p>
                                    <p className="text-xs text-zinc-500">Hỏi bất kỳ câu hỏi nào về lượt truy cập, thi thử, người dùng...</p>
                                </div>
                            </div>
                            <span className="text-zinc-400 text-lg">{chatOpen ? "▲" : "▼"}</span>
                        </div>
                        {chatOpen ? (
                            <div>
                                <div className="bg-white/60 rounded-xl border border-indigo-100 p-3 h-64 overflow-y-auto mb-3 space-y-2">
                                    {chatHistory.map((m, i) => (
                                        <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                                            <div className={`max-w-[80%] rounded-xl px-3 py-2 text-sm ${m.role === "user" ? "bg-indigo-600 text-white" : "bg-zinc-100 text-zinc-700"}`}>
                                                <div className="whitespace-pre-wrap leading-relaxed">{m.text}</div>
                                            </div>
                                        </div>
                                    ))}
                                    {chatLoading ? (
                                        <div className="flex justify-start">
                                            <div className="bg-zinc-100 rounded-xl px-3 py-2 text-sm text-zinc-500 inline-flex items-center gap-1.5"><Spinner /> Đang suy nghĩ...</div>
                                        </div>
                                    ) : null}
                                </div>
                                <div className="flex gap-2">
                                    <input
                                        type="text" value={chatInput} onChange={e => setChatInput(e.target.value)}
                                        onKeyDown={e => e.key === "Enter" && sendChat()}
                                        placeholder="Ví dụ: Tuần này có bao nhiêu người dùng mới?"
                                        className="flex-1 rounded-xl border border-indigo-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
                                    />
                                    <button type="button" disabled={chatLoading || !chatInput.trim()} onClick={sendChat}
                                        className="rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 px-4 py-2 text-sm font-medium text-white hover:from-indigo-700 hover:to-purple-700 disabled:opacity-50 shadow-md">
                                        Gửi
                                    </button>
                                </div>
                                <div className="flex flex-wrap gap-1.5 mt-2">
                                    {["Trấn này có bao nhiêu lượt xem?", "So sánh traffic tuần này vs tuần trước", "Tình huống nào được xem nhiều nhất?", "Tỷ lệ chuyển đổi landing?"].map(q => (
                                        <button key={q} type="button" onClick={() => { setChatInput(q); }} className="text-xs bg-indigo-50 text-indigo-700 px-2 py-1 rounded-lg hover:bg-indigo-100 border border-indigo-100">{q}</button>
                                    ))}
                                </div>
                            </div>
                        ) : null}
                    </div>

                    {/* ── AI Deep Analysis (existing report) ── */}
                    <div className="rounded-2xl border border-violet-200/60 bg-gradient-to-br from-violet-50 via-white to-indigo-50 p-5">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 text-white text-lg shadow-md">🤖</div>
                                <div><p className="text-sm font-bold text-zinc-700">Phân tích AI chi tiết</p><p className="text-xs text-zinc-500">GPT-4o-mini phân tích sâu hành vi &amp; gợi ý chiến lược</p></div>
                            </div>
                            <button type="button" disabled={aiLoading} onClick={runAi} className="rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:from-violet-700 hover:to-indigo-700 disabled:opacity-50 shadow-md">
                                {aiLoading ? <span className="inline-flex items-center gap-1.5"><Spinner /> Đang phân tích...</span> : "🔍 Phân tích AI"}
                            </button>
                        </div>
                        {aiReport ? (
                            <div className="prose prose-sm max-w-none text-zinc-700 whitespace-pre-wrap leading-relaxed bg-white/60 rounded-xl p-4 border border-violet-100">{aiReport}</div>
                        ) : (
                            <p className="text-sm text-zinc-400">Nhấn &quot;Phân tích AI&quot; để AI phân tích chi tiết {selectedRange > 1 ? `${selectedRange} ngày` : `ngày ${selectedDate}`} ({activeTab === "all" ? "tất cả site" : activeTab}).</p>
                        )}
                    </div>

                    {/* ═════ Phase 3: Advanced Analytics ═════ */}

                    {/* ── Real-time Widget ── */}
                    {realtime ? (
                        <div className="rounded-2xl border-2 border-rose-200/60 bg-gradient-to-br from-rose-50 via-white to-orange-50 p-5">
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-2">
                                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-rose-500 to-orange-600 text-white text-lg shadow-md">🟢</div>
                                    <div>
                                        <p className="text-sm font-bold text-zinc-700">Thời gian thực</p>
                                        <p className="text-xs text-zinc-500">{realtime.activeInLastMin} người trong 1 phút qua</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-4">
                                    <div className="text-center">
                                        <p className="text-2xl font-black text-rose-600">{realtime.activeUsers}</p>
                                        <p className="text-[10px] text-zinc-400 uppercase">Người dùng</p>
                                    </div>
                                    <div className="text-center">
                                        <p className="text-2xl font-black text-orange-600">{realtime.activeSessions}</p>
                                        <p className="text-[10px] text-zinc-400 uppercase">Phiên</p>
                                    </div>
                                </div>
                            </div>
                            {/* Sparkline */}
                            <div className="flex items-end gap-px h-12 mb-3">
                                {realtime.sparkline.map((v, i) => {
                                    const max = Math.max(...realtime.sparkline, 1);
                                    const h = Math.max(2, Math.round((v / max) * 100));
                                    return <div key={i} className={`flex-1 rounded-t transition-all ${v > 0 ? 'bg-gradient-to-t from-rose-400 to-orange-300' : 'bg-zinc-100'}`} style={{ height: `${h}%` }} title={`${30 - i} phút trước: ${v} views`} />;
                                })}
                            </div>
                            <p className="text-xs text-zinc-400 text-center mb-3">Lượt xem 30 phút qua: {realtime.totalLast30Min}</p>
                            {/* Active pages + Event stream */}
                            <div className="grid gap-3 lg:grid-cols-2">
                                <div>
                                    <p className="text-xs font-bold text-zinc-500 mb-2">Trang đang xem</p>
                                    {realtime.topActivePages.map(p => (
                                        <div key={p.page} className="flex justify-between text-xs py-1 border-b border-zinc-100">
                                            <span className="text-zinc-600 truncate">{p.page}</span>
                                            <span className="font-bold text-rose-600">{p.views}</span>
                                        </div>
                                    ))}
                                </div>
                                <div>
                                    <p className="text-xs font-bold text-zinc-500 mb-2">Sự kiện gần nhất</p>
                                    <div className="space-y-1 max-h-32 overflow-y-auto">
                                        {realtime.eventStream.slice(0, 8).map((e, i) => (
                                            <div key={i} className="flex items-center gap-2 text-xs">
                                                <span className="w-10 text-zinc-400 text-right">{e.ago}s</span>
                                                <span className={`px-1.5 py-0.5 rounded font-medium ${e.type === 'page_view' ? 'bg-blue-100 text-blue-700' : e.type.includes('exam') ? 'bg-violet-100 text-violet-700' : 'bg-zinc-100 text-zinc-600'}`}>{e.type}</span>
                                                <span className="text-zinc-500 truncate">{e.page}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : null}

                    {/* ── Cohort + Geo + Attribution (collapsible) ── */}
                    <div className="grid gap-4 lg:grid-cols-3">
                        {/* Cohort toggle */}
                        <button type="button" onClick={() => setShowCohort(!showCohort)} className={`rounded-2xl p-4 text-left border-2 transition-all ${showCohort ? 'border-sky-400 bg-sky-50' : 'border-zinc-200 bg-white hover:border-sky-200'}`}>
                            <p className="text-lg mb-1">📊</p>
                            <p className="text-sm font-bold text-zinc-700">Nhóm người dùng</p>
                            <p className="text-xs text-zinc-500">Tỷ lệ quay lại theo tuần</p>
                        </button>
                        {/* Geo toggle */}
                        <button type="button" onClick={() => setShowGeo(!showGeo)} className={`rounded-2xl p-4 text-left border-2 transition-all ${showGeo ? 'border-emerald-400 bg-emerald-50' : 'border-zinc-200 bg-white hover:border-emerald-200'}`}>
                            <p className="text-lg mb-1">🌍</p>
                            <p className="text-sm font-bold text-zinc-700">Địa lý</p>
                            <p className="text-xs text-zinc-500">Theo quốc gia</p>
                        </button>
                        {/* Attribution toggle */}
                        <button type="button" onClick={() => setShowAttribution(!showAttribution)} className={`rounded-2xl p-4 text-left border-2 transition-all ${showAttribution ? 'border-amber-400 bg-amber-50' : 'border-zinc-200 bg-white hover:border-amber-200'}`}>
                            <p className="text-lg mb-1">🎯</p>
                            <p className="text-sm font-bold text-zinc-700">Nguồn chuyển đổi</p>
                            <p className="text-xs text-zinc-500">Nguồn chuyển đổi</p>
                        </button>
                    </div>

                    {/* Cohort Heatmap */}
                    {showCohort && cohort.length > 0 ? (
                        <div className="rounded-2xl border border-sky-200/60 bg-white p-4 overflow-x-auto">
                            <p className="text-xs font-bold uppercase tracking-wide text-zinc-500 mb-3">📊 Tỷ lệ quay lại (Theo tuần đăng ký)</p>
                            <table className="text-xs w-full">
                                <thead>
                                    <tr className="text-zinc-500">
                                        <th className="text-left py-1 pr-3">Tuần</th>
                                        <th className="text-right pr-3">Người</th>
                                        {Array.from({ length: 8 }, (_, i) => <th key={i} className="text-center px-1">T{i}</th>)}
                                    </tr>
                                </thead>
                                <tbody>
                                    {cohort.filter(c => c.totalUsers > 0).map(c => (
                                        <tr key={c.cohortWeek}>
                                            <td className="text-zinc-600 font-medium py-1 pr-3">{c.cohortWeek}</td>
                                            <td className="text-right pr-3 font-bold text-zinc-700">{c.totalUsers}</td>
                                            {c.retention.map((r, i) => {
                                                const bg = r >= 80 ? 'bg-sky-600 text-white' : r >= 50 ? 'bg-sky-400 text-white' : r >= 20 ? 'bg-sky-200 text-sky-800' : r > 0 ? 'bg-sky-100 text-sky-600' : 'bg-zinc-50 text-zinc-300';
                                                return <td key={i} className={`text-center px-1 py-1 rounded ${bg} font-medium`}>{r}%</td>;
                                            })}
                                            {Array.from({ length: Math.max(0, 8 - c.retention.length) }, (_, i) => <td key={`empty-${i}`} className="text-center px-1 text-zinc-200">-</td>)}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : null}

                    {/* Geographic Breakdown */}
                    {showGeo && geoData.length > 0 ? (
                        <div className="rounded-2xl border border-emerald-200/60 bg-white p-4">
                            <p className="text-xs font-bold uppercase tracking-wide text-zinc-500 mb-3">🌍 Phân bố địa lý</p>
                            <div className="space-y-2">
                                {geoData.map(g => (
                                    <div key={g.country} className="flex items-center gap-3">
                                        <span className="text-sm w-6">{g.country === 'VN' ? '🇻🇳' : g.country === 'US' ? '🇺🇸' : g.country === 'Unknown' ? '❓' : '🌐'}</span>
                                        <span className="text-xs text-zinc-600 font-medium flex-1">{g.country}</span>
                                        <div className="w-24 h-2 bg-zinc-100 rounded-full overflow-hidden">
                                            <div className="h-full bg-emerald-400 rounded-full" style={{ width: `${g.pct}%` }} />
                                        </div>
                                        <span className="text-xs font-bold text-zinc-700 w-10 text-right">{g.pct}%</span>
                                        <span className="text-xs text-zinc-400 w-16 text-right">{g.sessions} phiên</span>
                                        <span className="text-xs text-zinc-400 w-14 text-right">{g.users} người</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : null}

                    {/* Province Breakdown (VN) */}
                    {showGeo && provinceData.length > 0 ? (
                        <div className="rounded-2xl border border-emerald-200/60 bg-gradient-to-br from-emerald-50 via-white to-green-50 p-5">
                            <div className="flex items-center gap-2 mb-4">
                                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-green-600 text-white text-lg shadow-md">🇻🇳</div>
                                <div>
                                    <p className="text-sm font-bold text-zinc-700">Chi tiết tỉnh/thành Việt Nam</p>
                                    <p className="text-xs text-zinc-500">{provinceData.length} tỉnh/thành · {provinceData.reduce((s, p) => s + p.sessions, 0)} phiên</p>
                                </div>
                            </div>
                            <div className="grid gap-2 sm:grid-cols-2">
                                {provinceData.map((p, i) => (
                                    <div key={p.province} className="flex items-center gap-2 bg-white/70 rounded-xl p-2.5 border border-emerald-100 hover:border-emerald-300 transition-all">
                                        <span className={`text-xs font-bold w-5 text-right ${i < 3 ? "text-emerald-600" : "text-zinc-400"}`}>{i + 1}</span>
                                        <span className="text-xs text-zinc-700 font-medium flex-1 truncate">{p.province}</span>
                                        <div className="w-16 h-1.5 bg-zinc-100 rounded-full overflow-hidden">
                                            <div className="h-full bg-gradient-to-r from-emerald-400 to-green-500 rounded-full" style={{ width: `${p.pct}%` }} />
                                        </div>
                                        <span className="text-[10px] font-bold text-emerald-600 w-8 text-right">{p.pct}%</span>
                                        <span className="text-[10px] text-zinc-400 w-12 text-right">{p.sessions} phiên</span>
                                        <span className="text-[10px] text-zinc-400 w-12 text-right">{p.users} người</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : null}

                    {/* Conversion Attribution */}
                    {showAttribution && attribution ? (
                        <div className="rounded-2xl border border-amber-200/60 bg-white p-4">
                            <div className="flex items-center justify-between mb-3">
                                <p className="text-xs font-bold uppercase tracking-wide text-zinc-500">🎯 Nguồn chuyển đổi (UTM → Chuyển đổi)</p>
                                <span className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded-lg font-bold">Tổng: {attribution.overallRate}%</span>
                            </div>
                            {/* Site conversion summary */}
                            <div className="flex gap-3 mb-4">
                                {Object.entries(attribution.siteConversions).map(([site, d]) => (
                                    <div key={site} className="flex-1 rounded-xl bg-zinc-50 p-2 text-center">
                                        <p className="text-xs text-zinc-500">{site === 'mophong' ? '🚗 Mô Phỏng' : site === 'taplai' ? '📚 Lý Thuyết' : '🌐 Landing'}</p>
                                        <p className="text-sm font-bold text-zinc-700">{d.rate}%</p>
                                        <p className="text-xs text-zinc-400">{d.conversions}/{d.total}</p>
                                    </div>
                                ))}
                            </div>
                            {attribution.rows.length > 0 ? (
                                <table className="text-xs w-full">
                                    <thead>
                                        <tr className="text-zinc-500 border-b border-zinc-100">
                                            <th className="text-left py-2">Nguồn</th>
                                            <th className="text-right">Phiên</th>
                                            <th className="text-right">Chuyển đổi</th>
                                            <th className="text-right">Tỷ lệ</th>
                                            <th className="text-right">Chi tiết</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {attribution.rows.map(r => (
                                            <tr key={`${r.source}/${r.medium}`} className="border-b border-zinc-50">
                                                <td className="py-2">
                                                    <span className="font-medium text-zinc-700">{r.source}</span>
                                                    <span className="text-zinc-400"> / {r.medium}</span>
                                                </td>
                                                <td className="text-right text-zinc-600">{r.sessions}</td>
                                                <td className="text-right font-bold text-amber-600">{r.conversions}</td>
                                                <td className="text-right">
                                                    <span className={`font-bold ${r.conversionRate > 10 ? 'text-green-600' : r.conversionRate > 0 ? 'text-amber-600' : 'text-zinc-400'}`}>{r.conversionRate}%</span>
                                                </td>
                                                <td className="text-right text-zinc-400">
                                                    {Object.entries(r.types).map(([k, v]) => `${k}:${v}`).join(', ')}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            ) : <p className="text-xs text-zinc-400">Chưa có dữ liệu attribution.</p>}
                        </div>
                    ) : null}

                    {/* ═════ Phase 4: Goals + Settings ═════ */}

                    {/* ── Goal Tracking ── */}
                    {widgets.goals ? (
                        <div className="rounded-2xl border-2 border-teal-200/60 bg-gradient-to-br from-teal-50 via-white to-cyan-50 p-5">
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-2">
                                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-teal-500 to-cyan-600 text-white text-lg shadow-md">🎯</div>
                                    <div>
                                        <p className="text-sm font-bold text-zinc-700">Theo dõi mục tiêu</p>
                                        <p className="text-xs text-zinc-500">{goals.length} mục tiêu đang theo dõi</p>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <button type="button" onClick={generateDigest} disabled={digestLoading} className="rounded-xl bg-zinc-100 px-3 py-2 text-xs font-medium text-zinc-600 hover:bg-zinc-200 disabled:opacity-50">
                                        {digestLoading ? "⏳ Đang tạo..." : "📧 Báo cáo Email"}
                                    </button>
                                    <button type="button" onClick={() => setShowGoalForm(!showGoalForm)} className="rounded-xl bg-gradient-to-r from-teal-600 to-cyan-600 px-3 py-2 text-xs font-medium text-white hover:from-teal-700 hover:to-cyan-700 shadow-md">
                                        + Thêm mục tiêu
                                    </button>
                                </div>
                            </div>

                            {showGoalForm ? (
                                <div className="bg-white/80 rounded-xl p-3 mb-4 border border-teal-100 space-y-2">
                                    <input value={goalForm.name} onChange={e => setGoalForm(f => ({ ...f, name: e.target.value }))} placeholder="Tên mục tiêu (VD: 100 lượt xem/ngày)" className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-xs" />
                                    <div className="grid grid-cols-4 gap-2">
                                        <select value={goalForm.metric} onChange={e => setGoalForm(f => ({ ...f, metric: e.target.value }))} className="rounded-lg border border-zinc-200 px-2 py-2 text-xs">
                                            <option value="page_views">Lượt xem trang</option>
                                            <option value="sessions">Phiên truy cập</option>
                                            <option value="conversions">Chuyển đổi</option>
                                            <option value="exam_starts">Bắt đầu thi</option>
                                            <option value="form_submits">Gửi form</option>
                                        </select>
                                        <input value={goalForm.target} onChange={e => setGoalForm(f => ({ ...f, target: e.target.value }))} placeholder="Mục tiêu" type="number" className="rounded-lg border border-zinc-200 px-2 py-2 text-xs" />
                                        <select value={goalForm.period} onChange={e => setGoalForm(f => ({ ...f, period: e.target.value }))} className="rounded-lg border border-zinc-200 px-2 py-2 text-xs">
                                            <option value="daily">Hàng ngày</option>
                                            <option value="weekly">Hàng tuần</option>
                                            <option value="monthly">Hàng tháng</option>
                                        </select>
                                        <select value={goalForm.site} onChange={e => setGoalForm(f => ({ ...f, site: e.target.value }))} className="rounded-lg border border-zinc-200 px-2 py-2 text-xs">
                                            <option value="">Tất cả site</option>
                                            <option value="mophong">Mô Phỏng</option>
                                            <option value="taplai">Lý Thuyết</option>
                                            <option value="landing">Landing</option>
                                        </select>
                                    </div>
                                    <div className="flex gap-2">
                                        <button type="button" onClick={createGoal} disabled={!goalForm.name} className="rounded-lg bg-teal-600 px-4 py-1.5 text-xs text-white hover:bg-teal-700 disabled:opacity-50">Lưu</button>
                                        <button type="button" onClick={() => setShowGoalForm(false)} className="rounded-lg bg-zinc-100 px-4 py-1.5 text-xs text-zinc-600">Hủy</button>
                                    </div>
                                </div>
                            ) : null}

                            {goals.length > 0 ? (
                                <div className="space-y-2">
                                    {goals.map(g => (
                                        <div key={g.id} className="flex items-center gap-3 bg-white/60 rounded-xl p-3 border border-teal-50">
                                            <div className="text-lg">{g.pct >= 100 ? "✅" : g.pct >= 50 ? "🟡" : "🔴"}</div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center justify-between mb-1">
                                                    <span className="text-xs font-medium text-zinc-700 truncate">{g.name}</span>
                                                    <span className="text-xs text-zinc-400">{{ page_views: "Lượt xem", sessions: "Phiên", conversions: "Chuyển đổi", exam_starts: "Bắt đầu thi", form_submits: "Gửi form" }[g.metric] || g.metric} · {{ daily: "Hàng ngày", weekly: "Hàng tuần", monthly: "Hàng tháng" }[g.period] || g.period}{g.site ? ` · ${g.site}` : ""}</span>
                                                </div>
                                                <div className="w-full h-2 bg-zinc-100 rounded-full overflow-hidden">
                                                    <div className={`h-full rounded-full transition-all ${g.pct >= 100 ? "bg-green-500" : g.pct >= 50 ? "bg-amber-400" : "bg-rose-400"}`} style={{ width: `${Math.min(g.pct, 100)}%` }} />
                                                </div>
                                                <div className="flex justify-between mt-1">
                                                    <span className="text-[10px] text-zinc-400">{g.current} / {g.target}</span>
                                                    <span className={`text-[10px] font-bold ${g.pct >= 100 ? "text-green-600" : g.pct >= 50 ? "text-amber-600" : "text-rose-500"}`}>{g.pct}%</span>
                                                </div>
                                            </div>
                                            <button type="button" onClick={() => deleteGoal(g.id)} className="text-xs text-zinc-300 hover:text-rose-500">✕</button>
                                        </div>
                                    ))}
                                </div>
                            ) : <p className="text-xs text-zinc-400 text-center py-2">Chưa có mục tiêu. Nhấn &quot;Thêm mục tiêu&quot; để bắt đầu.</p>}
                        </div>
                    ) : null}

                    {/* ── Dashboard Settings ── */}
                    <div className="flex justify-center">
                        <button type="button" onClick={() => setShowSettings(!showSettings)} className="text-xs text-zinc-400 hover:text-zinc-600 flex items-center gap-1">
                            ⚙️ {showSettings ? "Ẩn cài đặt" : "Tùy chỉnh bảng điều khiển"}
                        </button>
                    </div>
                    {showSettings ? (
                        <div className="rounded-2xl border border-zinc-200 bg-white p-4">
                            <p className="text-xs font-bold text-zinc-500 mb-3">⚙️ Hiển thị mục</p>
                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                                {([
                                    ["realtime", "🟢 Thời gian thực"],
                                    ["goals", "🎯 Mục tiêu"],
                                    ["insights", "💡 Phân tích"],
                                    ["chatbot", "💬 Trò chuyện AI"],
                                    ["cohort", "📊 Nhóm người dùng"],
                                    ["geo", "🌍 Địa lý"],
                                    ["attribution", "🎯 Nguồn chuyển đổi"],
                                ] as [keyof WidgetVisibility, string][]).map(([key, label]) => (
                                    <button type="button" key={key} onClick={() => toggleWidget(key)}
                                        className={`rounded-xl py-2 px-3 text-xs font-medium transition-all ${widgets[key] ? "bg-indigo-100 text-indigo-700 border border-indigo-200" : "bg-zinc-50 text-zinc-400 border border-zinc-100"}`}>
                                        {label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    ) : null}
                </>
            ) : null}
        </div>
    );
}
