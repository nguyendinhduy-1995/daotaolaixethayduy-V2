"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { fetchJson, type ApiClientError } from "@/lib/api-client";
import { clearToken, fetchMe, getToken, type MeResponse } from "@/lib/auth-client";
import { isAdminRole, isTelesalesRole } from "@/lib/admin-auth";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Pagination } from "@/components/ui/pagination";
import { Spinner } from "@/components/ui/spinner";
import { Table } from "@/components/ui/table";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { MobileShell } from "@/components/mobile/MobileShell";
import { SuggestedChecklist } from "@/components/mobile/SuggestedChecklist";
import { UI_TEXT } from "@/lib/ui-text.vi";
import {
  formatCurrencyVnd,
  formatDateTimeVi,
  formatTimeHms,
  formatTimeHm,
  todayInHoChiMinh,
} from "@/lib/date-utils";

type KpiDaily = {
  date: string;
  monthKey: string;
  directPage: {
    hasPhoneRate: {
      daily: { numerator: number; denominator: number; valuePct: number };
      monthly: { numerator: number; denominator: number; valuePct: number };
    };
  };
  tuVan: {
    appointedRate: {
      daily: { numerator: number; denominator: number; valuePct: number };
      monthly: { numerator: number; denominator: number; valuePct: number };
    };
    arrivedRate: {
      daily: { numerator: number; denominator: number; valuePct: number };
      monthly: { numerator: number; denominator: number; valuePct: number };
    };
    signedRate: {
      daily: { numerator: number; denominator: number; valuePct: number };
      monthly: { numerator: number; denominator: number; valuePct: number };
    };
  };
};

type ReceiptsSummary = {
  date: string;
  totalThu: number;
  totalPhieuThu: number;
};

type LeadItem = {
  id: string;
  fullName: string | null;
  phone: string | null;
  source: string | null;
  channel: string | null;
  licenseType: string | null;
  status: string;
  ownerId: string | null;
  createdAt: string;
};

type LeadsResponse = {
  items: LeadItem[];
  page: number;
  pageSize: number;
  total: number;
};

type AutomationLog = {
  id: string;
  status: string;
  sentAt: string;
  payload?: {
    runtimeStatus?: string;
    leadId?: string | null;
    studentId?: string | null;
  } | null;
};

type AutomationLogsResponse = {
  items: AutomationLog[];
  page: number;
  pageSize: number;
  total: number;
};

type NotificationCountResponse = {
  items: Array<{ id: string }>;
  page: number;
  pageSize: number;
  total: number;
};

type ExpenseSummary = {
  monthKey: string;
  expensesTotalVnd: number;
  baseSalaryTotalVnd: number;
  grandTotalVnd: number;
  insights: Array<{ id: string; summary: string }>;
};

type AiSuggestionMini = {
  id: string;
  scoreColor: "RED" | "YELLOW" | "GREEN";
  title: string;
  content: string;
};

type AiSummaryResponse = {
  hasSummary: boolean;
  summary: string;
  topSuggestion: { id: string; title: string; scoreColor: string; preview: string } | null;
  totalActive: number;
};

type StaleSummary = { total: number };

type MetricStatus = "NEW" | "HAS_PHONE" | "APPOINTED" | "ARRIVED" | "SIGNED" | "LOST";

type DrilldownState = {
  open: boolean;
  title: string;
  status: MetricStatus | null;
  page: number;
  pageSize: number;
  total: number;
  loading: boolean;
  items: LeadItem[];
};

function parseError(error: unknown) {
  const e = error as ApiClientError;
  return `${e.code || "INTERNAL_ERROR"}: ${e.message || "Lỗi không xác định"}`;
}

async function fetchLeadsCountByStatus(date: string, status: MetricStatus, token: string) {
  const params = new URLSearchParams({
    status,
    createdFrom: date,
    createdTo: date,
    page: "1",
    pageSize: "1",
    sort: "createdAt",
    order: "desc",
  });
  const res = await fetchJson<LeadsResponse>(`/api/leads?${params.toString()}`, { token });
  return res.total;
}

/* ── Mini stat card ──────────────────────────────────────────── */
const LEAD_STATUS_STYLE: Record<MetricStatus, { icon: string; gradient: string; text: string }> = {
  NEW: { icon: "🆕", gradient: "from-blue-500 to-indigo-500", text: "text-blue-600" },
  HAS_PHONE: { icon: "📱", gradient: "from-cyan-500 to-blue-500", text: "text-cyan-600" },
  APPOINTED: { icon: "📋", gradient: "from-violet-500 to-purple-500", text: "text-violet-600" },
  ARRIVED: { icon: "🏢", gradient: "from-amber-500 to-orange-500", text: "text-amber-600" },
  SIGNED: { icon: "✅", gradient: "from-emerald-500 to-green-500", text: "text-emerald-600" },
  LOST: { icon: "❌", gradient: "from-rose-500 to-red-500", text: "text-rose-600" },
};

function MiniMetricCard({ status, label, count, onClick, delay }: {
  status: MetricStatus; label: string; count: number; onClick: () => void; delay: string;
}) {
  const style = LEAD_STATUS_STYLE[status];
  return (
    <button
      type="button"
      onClick={onClick}
      className={`animate-fadeInUp ${delay} group relative overflow-hidden rounded-xl border border-zinc-200/60 bg-white p-3.5 text-left transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5 active:scale-95`}
    >
      <div className={`absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r ${style.gradient} opacity-60 group-hover:opacity-100 transition-opacity`} />
      <div className="flex items-center gap-2">
        <span className="text-base">{style.icon}</span>
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">{label}</p>
      </div>
      <p className={`mt-2 text-2xl font-bold ${style.text}`}>{count}</p>
    </button>
  );
}

/* ── KPI mini gauge ──────────────────────────────────────────── */
function KpiGauge({ label, value, color }: { label: string; value: number; color: string }) {
  const pct = Math.min(100, Math.max(0, value));
  return (
    <div className="rounded-xl border border-zinc-200/60 bg-white p-3.5 transition-all duration-300 hover:shadow-md">
      <p className="text-xs font-medium uppercase tracking-wide text-zinc-400 mb-2">{label}</p>
      <p className="text-xl font-bold text-zinc-900">{value.toFixed(2)}%</p>
      <div className="mt-2 h-1.5 rounded-full bg-zinc-100 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700 ease-out"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

/* ── Finance stat ────────────────────────────────────────────── */
function FinanceStat({ label, value, icon }: { label: string; value: string; icon: string }) {
  return (
    <div className="rounded-xl border border-zinc-200/60 bg-white p-3.5 transition-all duration-300 hover:shadow-md">
      <div className="flex items-center gap-2 mb-1.5">
        <span className="text-sm">{icon}</span>
        <p className="text-xs uppercase tracking-wide text-zinc-400">{label}</p>
      </div>
      <p className="text-lg font-bold text-zinc-900">{value}</p>
    </div>
  );
}

/* ── Section Header ──────────────────────────────────────────── */
function SectionHeader({ icon, gradient, title, badge, action }: {
  icon: string; gradient: string; title: string; badge?: React.ReactNode; action?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between mb-3">
      <div className="flex items-center gap-2.5">
        <div className={`flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br ${gradient} text-white text-sm shadow-sm`}>
          {icon}
        </div>
        <h2 className="text-sm font-bold text-zinc-700">{title}</h2>
      </div>
      <div className="flex items-center gap-2">
        {badge}
        {action}
      </div>
    </div>
  );
}

/* ── Loading skeleton ────────────────────────────────────────── */
function DashboardSkeleton() {
  return (
    <div className="grid gap-4 lg:grid-cols-2 animate-pulse">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="rounded-2xl border border-zinc-200/60 bg-white p-5">
          <Skeleton className="mb-3 h-5 w-28" />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, j) => (
              <div key={j} className="rounded-xl border border-zinc-100 bg-zinc-50 p-3">
                <Skeleton className="mb-2 h-3 w-16" />
                <Skeleton className="h-7 w-12" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const today = useMemo(() => todayInHoChiMinh(), []);

  const [user, setUser] = useState<MeResponse["user"] | null>(null);
  const [kpi, setKpi] = useState<KpiDaily | null>(null);
  const [receiptsSummary, setReceiptsSummary] = useState<ReceiptsSummary | null>(null);
  const [leadsByStatus, setLeadsByStatus] = useState<Record<MetricStatus, number>>({
    NEW: 0,
    HAS_PHONE: 0,
    APPOINTED: 0,
    ARRIVED: 0,
    SIGNED: 0,
    LOST: 0,
  });
  const [unassignedCount, setUnassignedCount] = useState(0);
  const [automationStats, setAutomationStats] = useState({ sent: 0, failed: 0, skipped: 0 });
  const [todoCount, setTodoCount] = useState(0);
  const [expenseSummary, setExpenseSummary] = useState<ExpenseSummary | null>(null);
  const [aiSuggestions, setAiSuggestions] = useState<AiSuggestionMini[]>([]);
  const [aiSummary, setAiSummary] = useState<AiSummaryResponse | null>(null);
  const [staleCount, setStaleCount] = useState(0);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [mobileSearch, setMobileSearch] = useState("");

  const [drilldown, setDrilldown] = useState<DrilldownState>({
    open: false,
    title: "",
    status: null,
    page: 1,
    pageSize: 20,
    total: 0,
    loading: false,
    items: [],
  });

  const isAdmin = user ? isAdminRole(user.role) : false;
  const isTelesales = user ? isTelesalesRole(user.role) : false;

  const handleAuthError = useCallback(
    (err: ApiClientError) => {
      if (err.code === "AUTH_MISSING_BEARER" || err.code === "AUTH_INVALID_TOKEN") {
        clearToken();
        router.replace("/login");
        return true;
      }
      return false;
    },
    [router]
  );

  const loadUnassignedCount = useCallback(async (date: string, token: string) => {
    const data = await fetchJson<{ count: number }>(`/api/leads/unassigned-count?date=${date}`, { token });
    return data.count;
  }, []);

  const loadSnapshot = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    setLoading(true);
    setError("");

    try {
      const mePromise = fetchMe();
      const kpiPromise = fetchJson<KpiDaily>(`/api/kpi/daily?date=${today}`, { token });
      const receiptsPromise = fetchJson<ReceiptsSummary>(`/api/receipts/summary?date=${today}`, { token }).catch(
        () => null
      );
      const statusPromises: Promise<number>[] = [
        fetchLeadsCountByStatus(today, "NEW", token),
        fetchLeadsCountByStatus(today, "HAS_PHONE", token),
        fetchLeadsCountByStatus(today, "APPOINTED", token),
        fetchLeadsCountByStatus(today, "ARRIVED", token),
        fetchLeadsCountByStatus(today, "SIGNED", token),
        fetchLeadsCountByStatus(today, "LOST", token),
      ];
      const logsPromise = fetchJson<AutomationLogsResponse>(
        `/api/automation/logs?scope=daily&from=${today}&to=${today}&page=1&pageSize=100`,
        { token }
      ).catch(() => ({ items: [], page: 1, pageSize: 100, total: 0 }));
      const todoNewPromise = fetchJson<NotificationCountResponse>("/api/notifications?status=NEW&page=1&pageSize=1", {
        token,
      }).catch(() => ({ items: [], page: 1, pageSize: 1, total: 0 }));
      const todoDoingPromise = fetchJson<NotificationCountResponse>("/api/notifications?status=DOING&page=1&pageSize=1", {
        token,
      }).catch(() => ({ items: [], page: 1, pageSize: 1, total: 0 }));
      const expensePromise = fetchJson<ExpenseSummary>(`/api/expenses/summary?month=${today.slice(0, 7)}`, {
        token,
      }).catch(() => null);
      const aiPromise = fetchJson<{ items: AiSuggestionMini[] }>(`/api/ai/suggestions?date=${today}`, { token }).catch(
        () => ({ items: [] })
      );
      const aiSummaryPromise = fetchJson<AiSummaryResponse>(`/api/ai/suggestions/summary?date=${today}`, { token }).catch(
        () => null
      );
      const stalePromise = fetchJson<StaleSummary>(`/api/leads/stale?page=1&pageSize=1`, { token }).catch(
        () => null
      );

      const [me, kpiData, receiptData, statusData, logsData, todoNew, todoDoing, expenseData, aiData, aiSummaryData, staleData] = await Promise.all([
        mePromise,
        kpiPromise,
        receiptsPromise,
        Promise.all(statusPromises),
        logsPromise,
        todoNewPromise,
        todoDoingPromise,
        expensePromise,
        aiPromise,
        aiSummaryPromise,
        stalePromise,
      ]);

      setUser(me.user);
      setKpi(kpiData);
      setReceiptsSummary(receiptData);
      setLeadsByStatus({
        NEW: statusData[0],
        HAS_PHONE: statusData[1],
        APPOINTED: statusData[2],
        ARRIVED: statusData[3],
        SIGNED: statusData[4],
        LOST: statusData[5],
      });

      let sent = 0;
      let failed = 0;
      let skipped = 0;
      logsData.items.forEach((log) => {
        if (log.status === "sent") sent += 1;
        if (log.status === "failed") failed += 1;
        if (log.status === "skipped") skipped += 1;
      });
      setAutomationStats({ sent, failed, skipped });
      setTodoCount(todoNew.total + todoDoing.total);
      setExpenseSummary(expenseData);
      setAiSuggestions(Array.isArray(aiData.items) ? aiData.items.slice(0, 2) : []);
      setAiSummary(aiSummaryData);
      setStaleCount(staleData?.total ?? 0);

      if (isAdminRole(me.user.role)) {
        const unassigned = await loadUnassignedCount(today, token);
        setUnassignedCount(unassigned);
      } else {
        setUnassignedCount(0);
      }

      setLastUpdated(new Date());
    } catch (e) {
      const err = e as ApiClientError;
      if (!handleAuthError(err)) setError(parseError(err));
    } finally {
      setLoading(false);
    }
  }, [handleAuthError, loadUnassignedCount, today]);

  useEffect(() => {
    loadSnapshot();
  }, [loadSnapshot]);

  useEffect(() => {
    if (!autoRefresh) return;
    const timer = setInterval(() => {
      loadSnapshot();
    }, 60000);
    return () => clearInterval(timer);
  }, [autoRefresh, loadSnapshot]);

  const openDrilldown = useCallback((status: MetricStatus, title: string) => {
    setDrilldown((prev) => ({ ...prev, open: true, status, title, page: 1 }));
  }, []);

  const loadDrilldown = useCallback(
    async (status: MetricStatus, page: number, pageSize: number) => {
      const token = getToken();
      if (!token) return;
      setDrilldown((prev) => ({ ...prev, loading: true }));
      try {
        const params = new URLSearchParams({
          status,
          createdFrom: today,
          createdTo: today,
          page: String(page),
          pageSize: String(pageSize),
          sort: "createdAt",
          order: "desc",
        });
        const data = await fetchJson<LeadsResponse>(`/api/leads?${params.toString()}`, { token });
        setDrilldown((prev) => ({
          ...prev,
          items: data.items,
          total: data.total,
          page: data.page,
          pageSize: data.pageSize,
          loading: false,
        }));
      } catch (e) {
        const err = e as ApiClientError;
        if (!handleAuthError(err)) setError(`Lỗi tải danh sách khách: ${parseError(err)}`);
        setDrilldown((prev) => ({ ...prev, loading: false }));
      }
    },
    [handleAuthError, today]
  );

  useEffect(() => {
    if (!drilldown.open || !drilldown.status) return;
    loadDrilldown(drilldown.status, drilldown.page, drilldown.pageSize);
  }, [drilldown.open, drilldown.page, drilldown.pageSize, drilldown.status, loadDrilldown]);

  return (
    <MobileShell
      title="Trang chủ"
      subtitle="Điều hành nhanh trong ngày"
      rightAction={
        <button
          type="button"
          className="tap-feedback rounded-xl border border-zinc-200 bg-white/80 px-3 py-2 text-xs font-medium text-zinc-700"
          onClick={() => router.push("/leads")}
        >
          {UI_TEXT.nav.leads}
        </button>
      }
    >
      <div className="space-y-5 pb-24 md:pb-0">
        {/* ── Desktop Header ─────────────────────────────── */}
        <div className="hidden md:block">
          <PageHeader
            title="🏠 Tổng quan hôm nay"
            subtitle={`Ngày ${today}${lastUpdated ? ` • Cập nhật lần cuối: ${formatTimeHms(lastUpdated)}` : ""}`}
            actions={
              <>
                <label className="flex items-center gap-2 rounded-xl border border-zinc-200/60 bg-white px-3 py-2 text-sm text-zinc-600 cursor-pointer hover:bg-zinc-50 transition-colors">
                  <input type="checkbox" checked={autoRefresh} onChange={(e) => setAutoRefresh(e.target.checked)} className="accent-blue-600" />
                  Tự làm mới 60s
                </label>
                <Button variant="accent" onClick={loadSnapshot} disabled={loading}>
                  {loading ? (
                    <span className="inline-flex items-center gap-2">
                      <Spinner /> Đang tải...
                    </span>
                  ) : (
                    "🔄 Làm mới"
                  )}
                </Button>
              </>
            }
          />
        </div>

        {error ? <Alert type="error" message={`Có lỗi xảy ra: ${error}`} /> : null}

        {/* ── Mobile quick search ─────────────────────────── */}
        <section className="ios-glass space-y-3 rounded-2xl border border-zinc-200/70 p-3 md:hidden">
          <Input
            placeholder="Tìm nhanh tên/SĐT khách..."
            value={mobileSearch}
            onChange={(e) => setMobileSearch(e.target.value)}
          />
          <div className="flex gap-2">
            <Button
              className="tap-feedback flex-1"
              onClick={() => router.push(`/leads?q=${encodeURIComponent(mobileSearch.trim())}`)}
            >
              {UI_TEXT.common.search}
            </Button>
            <Button className="tap-feedback flex-1" variant="secondary" onClick={() => router.push("/leads")}>
              {UI_TEXT.mobile.quickAddLead}
            </Button>
          </div>
        </section>

        <SuggestedChecklist
          storageKey="dashboard-mobile-checklist"
          items={[
            { id: "todo", label: "Xử lý thông báo NEW/DOING", hint: "Giảm backlog trong ca", actionHref: "/notifications", actionLabel: "Mở" },
            { id: "ops", label: "Kiểm tra tình trạng Ops Pulse", hint: "Theo dõi cảnh báo nhân sự", actionHref: "/admin/ops", actionLabel: "Mở" },
            { id: "leads", label: "Rà khách chưa gán phụ trách", hint: "Tránh rơi data", actionHref: "/admin/assign-leads", actionLabel: "Mở" },
          ]}
        />

        {/* ── AI Suggestions Banner ──────────────────────── */}
        {aiSummary?.hasSummary ? (
          <Link href="/ai/kpi-coach" className="block animate-fadeInUp">
            <div className="group relative overflow-hidden rounded-2xl border border-violet-200/60 bg-gradient-to-br from-violet-50 via-white to-indigo-50 p-4 shadow-sm transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5">
              <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-violet-500 to-indigo-500" />
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 text-white shadow-sm">🤖</div>
                  <div>
                    <p className="text-sm font-bold text-zinc-800">AI Gợi ý hôm nay</p>
                    <p className="text-xs text-zinc-500 mt-0.5 line-clamp-1">{aiSummary.summary}</p>
                  </div>
                </div>
                <Badge text={`${aiSummary.totalActive} gợi ý`} tone="primary" pulse />
              </div>
              {aiSummary.topSuggestion?.preview ? (
                <p className="mt-2 text-xs text-zinc-600 line-clamp-2 pl-11">{aiSummary.topSuggestion.preview}</p>
              ) : null}
            </div>
          </Link>
        ) : null}

        {/* ── Stale alert ────────────────────────────────── */}
        {staleCount > 0 ? (
          <div className="animate-fadeInUp rounded-xl border border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50 px-4 py-3 text-sm text-amber-800 flex items-center gap-2">
            <span className="text-lg">⚠️</span>
            <span>Có <strong>{staleCount}</strong> khách hàng lâu chưa follow-up — cần xử lý sớm</span>
          </div>
        ) : null}

        {/* ── Loading skeletons ──────────────────────────── */}
        {loading && !kpi ? <DashboardSkeleton /> : null}

        {!isAdmin && (isTelesales || user) ? (
          <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm text-blue-700 flex items-center gap-2">
            <span>🔒</span> Bạn đang xem dữ liệu trong phạm vi quyền được cấp.
          </div>
        ) : null}

        {/* ── Main sections grid ─────────────────────────── */}
        <div className="grid gap-5 lg:grid-cols-2">

          {/* ── Khách hàng hôm nay ───────────────────────── */}
          <div className="animate-fadeInUp delay-1 rounded-2xl border border-zinc-200/60 bg-white p-5 shadow-sm">
            <SectionHeader
              icon="👥" gradient="from-blue-500 to-indigo-600" title="Khách hàng hôm nay"
              badge={<Badge text="Khách hàng" tone="accent" />}
            />
            <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
              {(
                [
                  ["NEW", "Khách mới"],
                  ["HAS_PHONE", "Đã có SĐT"],
                  ["APPOINTED", "Đã hẹn"],
                  ["ARRIVED", "Đã đến"],
                  ["SIGNED", "Đã ký"],
                  ["LOST", "Rớt"],
                ] as Array<[MetricStatus, string]>
              ).map(([status, label], i) => (
                <MiniMetricCard
                  key={status}
                  status={status}
                  label={label}
                  count={leadsByStatus[status]}
                  onClick={() => openDrilldown(status, label)}
                  delay={`delay-${i + 1}`}
                />
              ))}
            </div>
          </div>

          {/* ── KPI % hôm nay ────────────────────────────── */}
          <div className="animate-fadeInUp delay-2 rounded-2xl border border-zinc-200/60 bg-white p-5 shadow-sm">
            <SectionHeader icon="📊" gradient="from-emerald-500 to-teal-600" title="Tỷ lệ KPI hôm nay" badge={<Badge text="KPI %" tone="primary" />} />
            <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
              <KpiGauge label="Tỉ lệ lấy số" value={kpi?.directPage.hasPhoneRate.daily.valuePct ?? 0} color="#3b82f6" />
              <KpiGauge label="Tỉ lệ hẹn/data" value={kpi?.tuVan.appointedRate.daily.valuePct ?? 0} color="#8b5cf6" />
              <KpiGauge label="Tỉ lệ đến/hẹn" value={kpi?.tuVan.arrivedRate.daily.valuePct ?? 0} color="#f59e0b" />
              <KpiGauge label="Tỉ lệ ký/đến" value={kpi?.tuVan.signedRate.daily.valuePct ?? 0} color="#10b981" />
            </div>
          </div>

          {/* ── Tài chính hôm nay ────────────────────────── */}
          <div className="animate-fadeInUp delay-3 rounded-2xl border border-zinc-200/60 bg-white p-5 shadow-sm">
            <SectionHeader icon="💰" gradient="from-amber-500 to-orange-600" title="Tài chính hôm nay" badge={<Badge text="Thu tiền" tone="accent" />} />
            <div className="grid gap-2.5 sm:grid-cols-2">
              <FinanceStat label="Tổng thu" value={formatCurrencyVnd(receiptsSummary?.totalThu ?? 0)} icon="💵" />
              <FinanceStat label="Tổng phiếu thu" value={String(receiptsSummary?.totalPhieuThu ?? 0)} icon="🧾" />
              <FinanceStat label="Còn phải thu" value="Xem Phiếu thu" icon="📥" />
              <FinanceStat label="Đã đóng >= 50%" value="Xem Phiếu thu" icon="✅" />
            </div>
            <div className="mt-3">
              <Link
                href={`/receipts?from=${today}&to=${today}`}
                className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-200/60 bg-zinc-50 px-3.5 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100 hover:text-zinc-800 transition-all duration-200"
              >
                <span>📋</span> Mở phiếu thu hôm nay
              </Link>
            </div>
          </div>

          {/* ── Chi phí tháng ────────────────────────────── */}
          <div className="animate-fadeInUp delay-4 rounded-2xl border border-zinc-200/60 bg-white p-5 shadow-sm">
            <SectionHeader icon="💳" gradient="from-rose-500 to-pink-600" title="Chi phí tháng" badge={<Badge text="Chi phí" tone="accent" />} />
            <div className="grid gap-2.5 sm:grid-cols-2">
              <FinanceStat label="Chi phí vận hành" value={formatCurrencyVnd(expenseSummary?.expensesTotalVnd ?? 0)} icon="🏭" />
              <FinanceStat label="Lương cơ bản" value={formatCurrencyVnd(expenseSummary?.baseSalaryTotalVnd ?? 0)} icon="💼" />
              <div className="sm:col-span-2 rounded-xl border border-zinc-200/60 bg-gradient-to-r from-rose-50 to-pink-50 p-3.5 transition-all duration-300">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-sm">📊</span>
                  <p className="text-xs uppercase tracking-wide text-zinc-400">Tổng chi tháng</p>
                </div>
                <p className="text-xl font-bold text-rose-700">{formatCurrencyVnd(expenseSummary?.grandTotalVnd ?? 0)}</p>
              </div>
            </div>
            {expenseSummary?.insights?.[0]?.summary ? (
              <div className="mt-3 rounded-xl border border-amber-200/60 bg-amber-50 p-3 text-sm text-amber-800 flex items-start gap-2">
                <span className="mt-0.5">💡</span>
                <span>{expenseSummary.insights[0].summary}</span>
              </div>
            ) : null}
            <div className="mt-3">
              <Link
                href={`/expenses/monthly?month=${today.slice(0, 7)}`}
                className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-200/60 bg-zinc-50 px-3.5 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100 hover:text-zinc-800 transition-all duration-200"
              >
                <span>📊</span> Mở trang chi phí
              </Link>
            </div>
          </div>

          {/* ── Trợ lý công việc ─────────────────────────── */}
          <div className="animate-fadeInUp delay-5 rounded-2xl border border-zinc-200/60 bg-white p-5 shadow-sm">
            <SectionHeader icon="🤖" gradient="from-violet-500 to-purple-600" title="Trợ lý công việc" badge={<Badge text="Công việc" tone="primary" />} />
            {aiSuggestions.length === 0 ? (
              <div className="rounded-xl border border-zinc-100 bg-zinc-50 p-4 text-center">
                <p className="text-sm text-zinc-500">Chưa có gợi ý AI trong hôm nay.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {aiSuggestions.map((item) => (
                  <div key={item.id} className="rounded-xl border border-zinc-200/60 bg-white p-3.5 transition-all duration-300 hover:shadow-md">
                    <div className="flex items-center gap-2.5">
                      <span
                        className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-white text-xs font-bold shadow-sm ${item.scoreColor === "RED"
                            ? "bg-gradient-to-br from-rose-500 to-red-600"
                            : item.scoreColor === "YELLOW"
                              ? "bg-gradient-to-br from-amber-500 to-orange-600"
                              : "bg-gradient-to-br from-emerald-500 to-green-600"
                          }`}
                      >
                        {item.scoreColor === "RED" ? "!" : item.scoreColor === "YELLOW" ? "?" : "✓"}
                      </span>
                      <p className="text-sm font-semibold text-zinc-900">{item.title}</p>
                    </div>
                    <p className="mt-1.5 text-sm text-zinc-600 pl-8">{item.content}</p>
                  </div>
                ))}
              </div>
            )}
            <div className="mt-3">
              <Link
                href={`/ai/kpi-coach?date=${today}`}
                className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-200/60 bg-zinc-50 px-3.5 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100 hover:text-zinc-800 transition-all duration-200"
              >
                <span>🤖</span> Mở Trợ lý công việc
              </Link>
            </div>
          </div>

          {/* ── Automation hôm nay ───────────────────────── */}
          <div className="animate-fadeInUp delay-5 rounded-2xl border border-zinc-200/60 bg-white p-5 shadow-sm">
            <SectionHeader icon="⚡" gradient="from-cyan-500 to-blue-600" title="Automation hôm nay" badge={<Badge text="Vận hành" tone="primary" />} />
            <div className="grid gap-2.5 sm:grid-cols-3">
              <div className="rounded-xl border border-zinc-200/60 bg-white p-3.5 transition-all duration-300 hover:shadow-md">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-sm">✅</span>
                  <p className="text-xs uppercase tracking-wide text-zinc-400">Đã gửi</p>
                </div>
                <p className="text-xl font-bold text-emerald-600">{automationStats.sent}</p>
              </div>
              <div className="rounded-xl border border-zinc-200/60 bg-white p-3.5 transition-all duration-300 hover:shadow-md">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-sm">❌</span>
                  <p className="text-xs uppercase tracking-wide text-zinc-400">Thất bại</p>
                </div>
                <p className={`text-xl font-bold ${automationStats.failed > 0 ? "text-rose-600" : "text-zinc-900"}`}>{automationStats.failed}</p>
              </div>
              <div className="rounded-xl border border-zinc-200/60 bg-white p-3.5 transition-all duration-300 hover:shadow-md">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-sm">⏭️</span>
                  <p className="text-xs uppercase tracking-wide text-zinc-400">Bỏ qua</p>
                </div>
                <p className="text-xl font-bold text-zinc-900">{automationStats.skipped}</p>
              </div>
            </div>
            <div className="mt-3">
              <Link
                href={`/automation/logs?status=failed&from=${today}&to=${today}`}
                className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-200/60 bg-zinc-50 px-3.5 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100 hover:text-zinc-800 transition-all duration-200"
              >
                <span>🔍</span> Xem lỗi
              </Link>
            </div>
          </div>

          {/* ── Việc cần làm ─────────────────────────────── */}
          <div className="animate-fadeInUp delay-5 rounded-2xl border border-zinc-200/60 bg-white p-5 shadow-sm lg:col-span-2">
            <SectionHeader icon="📝" gradient="from-pink-500 to-rose-600" title="Việc cần làm" badge={<Badge text="Thông báo" tone="accent" />} />
            <div className="flex items-center gap-4">
              <div className="rounded-xl border border-zinc-200/60 bg-gradient-to-br from-pink-50 to-rose-50 p-4 flex-1">
                <p className="text-xs uppercase tracking-wide text-zinc-400 mb-1">Mới + Đang xử lý</p>
                <p className={`text-3xl font-bold ${todoCount > 0 ? "text-pink-600" : "text-zinc-900"}`}>{todoCount}</p>
              </div>
              <Link
                href="/notifications"
                className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-200/60 bg-zinc-50 px-4 py-3 text-sm font-medium text-zinc-600 hover:bg-zinc-100 hover:text-zinc-800 transition-all duration-200"
              >
                <span>📬</span> Mở hàng đợi
              </Link>
            </div>
          </div>
        </div>

        {/* ── Alerts ─────────────────────────────────────── */}
        <div className="space-y-2">
          {automationStats.failed > 0 ? (
            <div className="rounded-xl border border-rose-200 bg-gradient-to-r from-rose-50 to-red-50 px-4 py-3 text-sm text-rose-700 flex items-center gap-2">
              <span>🚨</span>
              Có <strong>{automationStats.failed}</strong> lượt automation thất bại hôm nay.
            </div>
          ) : null}
          {isAdmin && unassignedCount > 0 ? (
            <div className="rounded-xl border border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50 px-4 py-3 text-sm text-amber-700 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span>⚠️</span>
                <span>Có <strong>{unassignedCount}</strong> khách chưa được gán phụ trách hôm nay.</span>
              </div>
              <Link href="/admin/assign-leads" className="text-sm font-semibold text-amber-800 hover:underline whitespace-nowrap">
                Gán ngay →
              </Link>
            </div>
          ) : null}
        </div>

        {/* ── Drilldown Modal ────────────────────────────── */}
        <Modal
          open={drilldown.open}
          title={`Danh sách khách - ${drilldown.title}`}
          onClose={() => setDrilldown((prev) => ({ ...prev, open: false }))}
        >
          {drilldown.loading ? (
            <div className="flex items-center gap-2 text-zinc-700">
              <Spinner /> Đang tải...
            </div>
          ) : drilldown.items.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-3xl mb-2">📭</p>
              <p className="text-sm text-zinc-500">Không có dữ liệu.</p>
            </div>
          ) : (
            <div className="space-y-3">
              <Table headers={["Họ tên", "SĐT", "Nguồn", "Kênh", "Hạng bằng", "Trạng thái", "Ngày tạo", "Hành động"]}>
                {drilldown.items.map((lead) => (
                  <tr key={lead.id} className="border-t border-zinc-100">
                    <td className="px-3 py-2">{lead.fullName || "-"}</td>
                    <td className="px-3 py-2">{lead.phone || "-"}</td>
                    <td className="px-3 py-2">{lead.source || "-"}</td>
                    <td className="px-3 py-2">{lead.channel || "-"}</td>
                    <td className="px-3 py-2">{lead.licenseType || "-"}</td>
                    <td className="px-3 py-2">
                      <Badge text={lead.status} />
                    </td>
                    <td className="px-3 py-2">{formatDateTimeVi(lead.createdAt)}</td>
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        className="text-blue-700 hover:underline"
                        onClick={() => router.push(`/leads/${lead.id}`)}
                      >
                        Mở
                      </button>
                    </td>
                  </tr>
                ))}
              </Table>
              <Pagination
                page={drilldown.page}
                pageSize={drilldown.pageSize}
                total={drilldown.total}
                onPageChange={(nextPage) => {
                  setDrilldown((prev) => ({ ...prev, page: nextPage }));
                }}
              />
            </div>
          )}
        </Modal>

        {/* ── Footer ─────────────────────────────────────── */}
        <div className="text-xs text-zinc-400 text-center py-2">
          Múi giờ: Asia/Ho_Chi_Minh • {formatTimeHm(new Date())}
        </div>
      </div>
    </MobileShell>
  );
}
