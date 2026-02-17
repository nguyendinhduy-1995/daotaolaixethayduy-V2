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
import { SectionCard } from "@/components/ui/section-card";
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
      <div className="space-y-4 pb-24 md:pb-0">
        <div className="hidden md:block">
          <PageHeader
            title="Trang chủ hôm nay"
            subtitle={`Ngày ${today}${lastUpdated ? ` • Cập nhật lần cuối: ${formatTimeHms(lastUpdated)}` : ""}`}
            actions={
              <>
                <label className="flex items-center gap-2 rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-700">
                  <input type="checkbox" checked={autoRefresh} onChange={(e) => setAutoRefresh(e.target.checked)} />
                  Tự làm mới 60 giây
                </label>
                <Button variant="secondary" onClick={loadSnapshot} disabled={loading}>
                  {loading ? (
                    <span className="inline-flex items-center gap-2">
                      <Spinner /> Đang tải...
                    </span>
                  ) : (
                    "Làm mới"
                  )}
                </Button>
              </>
            }
          />
        </div>

        {error ? <Alert type="error" message={`Có lỗi xảy ra: ${error}`} /> : null}
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

        {aiSummary?.hasSummary ? (
          <Link href="/ai/kpi-coach" className="block">
            <SectionCard
              title="🤖 AI Gợi ý hôm nay"
              rightAction={<Badge text={`${aiSummary.totalActive} gợi ý`} tone="primary" />}
              className="p-4 transition hover:shadow-md"
            >
              <p className="text-sm text-zinc-700">{aiSummary.summary}</p>
              {aiSummary.topSuggestion?.preview ? (
                <p className="mt-1 text-xs text-zinc-500 line-clamp-2">{aiSummary.topSuggestion.preview}</p>
              ) : null}
            </SectionCard>
          </Link>
        ) : null}

        {staleCount > 0 ? (
          <Alert type="info" message={`⚠️ Có ${staleCount} khách hàng lâu chưa follow-up — cần xử lý sớm`} />
        ) : null}

        {loading && !kpi ? (
          <div className="grid gap-4 lg:grid-cols-2">
            <SectionCard title="Khách hàng hôm nay" className="p-4">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
                    <Skeleton className="mb-2 h-3 w-16" />
                    <Skeleton className="h-7 w-12" />
                  </div>
                ))}
              </div>
            </SectionCard>
            <SectionCard title="Tỷ lệ KPI hôm nay" className="p-4">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
                    <Skeleton className="mb-2 h-3 w-24" />
                    <Skeleton className="h-6 w-16" />
                  </div>
                ))}
              </div>
            </SectionCard>
          </div>
        ) : null}

        {!isAdmin && (isTelesales || user) ? (
          <Alert type="info" message="Bạn đang xem dữ liệu trong phạm vi quyền được cấp." />
        ) : null}

        <div className="grid gap-4 lg:grid-cols-2">
          <SectionCard
            title="Khách hàng hôm nay"
            rightAction={<Badge text="Khách hàng" tone="accent" />}
            className="p-4"
          >
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {(
                [
                  ["NEW", "Khách mới"],
                  ["HAS_PHONE", "Đã có SĐT"],
                  ["APPOINTED", "Đã hẹn"],
                  ["ARRIVED", "Đã đến"],
                  ["SIGNED", "Đã ký"],
                  ["LOST", "Rớt"],
                ] as Array<[MetricStatus, string]>
              ).map(([status, label]) => (
                <button
                  key={status}
                  type="button"
                  onClick={() => openDrilldown(status, label)}
                  className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-left transition hover:bg-zinc-100"
                >
                  <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">{label}</p>
                  <p className="mt-1 text-2xl font-semibold text-zinc-900">{leadsByStatus[status]}</p>
                </button>
              ))}
            </div>
          </SectionCard>

          <SectionCard title="Tỷ lệ KPI hôm nay" rightAction={<Badge text="KPI %" tone="primary" />} className="p-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-left">
                <p className="text-xs uppercase tracking-wide text-zinc-500">Tỉ lệ lấy được số</p>
                <p className="text-xl font-semibold text-zinc-900">{(kpi?.directPage.hasPhoneRate.daily.valuePct ?? 0).toFixed(2)}%</p>
              </div>
              <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-left">
                <p className="text-xs uppercase tracking-wide text-zinc-500">Tỉ lệ hẹn từ data</p>
                <p className="text-xl font-semibold text-zinc-900">{(kpi?.tuVan.appointedRate.daily.valuePct ?? 0).toFixed(2)}%</p>
              </div>
              <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-left">
                <p className="text-xs uppercase tracking-wide text-zinc-500">Tỉ lệ đến từ hẹn</p>
                <p className="text-xl font-semibold text-zinc-900">{(kpi?.tuVan.arrivedRate.daily.valuePct ?? 0).toFixed(2)}%</p>
              </div>
              <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-left">
                <p className="text-xs uppercase tracking-wide text-zinc-500">Tỉ lệ ký từ đến</p>
                <p className="text-xl font-semibold text-zinc-900">{(kpi?.tuVan.signedRate.daily.valuePct ?? 0).toFixed(2)}%</p>
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Tài chính hôm nay" rightAction={<Badge text="Thu tiền" tone="accent" />} className="p-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
                <p className="text-xs uppercase tracking-wide text-zinc-500">Tổng thu</p>
                <p className="text-xl font-semibold text-zinc-900">
                  {formatCurrencyVnd(receiptsSummary?.totalThu ?? 0)}
                </p>
              </div>
              <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
                <p className="text-xs uppercase tracking-wide text-zinc-500">Tổng phiếu thu</p>
                <p className="text-xl font-semibold text-zinc-900">
                  {receiptsSummary?.totalPhieuThu ?? 0}
                </p>
              </div>
              <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
                <p className="text-xs uppercase tracking-wide text-zinc-500">Còn phải thu</p>
                <p className="text-xl font-semibold text-zinc-900">Xem tại mục Phiếu thu</p>
              </div>
              <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
                <p className="text-xs uppercase tracking-wide text-zinc-500">Đã đóng &gt;= 50%</p>
                <p className="text-xl font-semibold text-zinc-900">Xem tại mục Phiếu thu</p>
              </div>
            </div>
            <div className="mt-3">
              <Link
                href={`/receipts?from=${today}&to=${today}`}
                className="inline-flex items-center rounded-xl border border-zinc-300 px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-100"
              >
                Mở danh sách phiếu thu hôm nay
              </Link>
            </div>
          </SectionCard>

          <SectionCard title="Chi phí tháng" rightAction={<Badge text="Chi phí" tone="accent" />} className="p-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
                <p className="text-xs uppercase tracking-wide text-zinc-500">Chi phí vận hành</p>
                <p className="text-xl font-semibold text-zinc-900">{formatCurrencyVnd(expenseSummary?.expensesTotalVnd ?? 0)}</p>
              </div>
              <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
                <p className="text-xs uppercase tracking-wide text-zinc-500">Lương cơ bản</p>
                <p className="text-xl font-semibold text-zinc-900">{formatCurrencyVnd(expenseSummary?.baseSalaryTotalVnd ?? 0)}</p>
              </div>
              <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 sm:col-span-2">
                <p className="text-xs uppercase tracking-wide text-zinc-500">Tổng chi tháng</p>
                <p className="text-xl font-semibold text-zinc-900">{formatCurrencyVnd(expenseSummary?.grandTotalVnd ?? 0)}</p>
              </div>
            </div>
            {expenseSummary?.insights?.[0]?.summary ? (
              <p className="mt-3 rounded-lg border border-zinc-200 bg-white p-3 text-sm text-zinc-700">
                Insight: {expenseSummary.insights[0].summary}
              </p>
            ) : null}
            <div className="mt-3">
              <Link
                href={`/expenses/monthly?month=${today.slice(0, 7)}`}
                className="inline-flex items-center rounded-xl border border-zinc-300 px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-100"
              >
                Mở trang chi phí
              </Link>
            </div>
          </SectionCard>

          <SectionCard title="Trợ lý công việc hôm nay" rightAction={<Badge text="Công việc" tone="primary" />} className="p-4">
            {aiSuggestions.length === 0 ? (
              <p className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-600">
                Chưa có gợi ý AI trong hôm nay.
              </p>
            ) : (
              <div className="space-y-2">
                {aiSuggestions.map((item) => (
                  <div key={item.id} className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-block h-2.5 w-2.5 rounded-full ${item.scoreColor === "RED"
                          ? "bg-rose-500"
                          : item.scoreColor === "YELLOW"
                            ? "bg-amber-500"
                            : "bg-emerald-500"
                          }`}
                      />
                      <p className="text-sm font-semibold text-zinc-900">{item.title}</p>
                    </div>
                    <p className="mt-1 text-sm text-zinc-600">{item.content}</p>
                  </div>
                ))}
              </div>
            )}
            <div className="mt-3">
              <Link
                href={`/ai/kpi-coach?date=${today}`}
                className="inline-flex items-center rounded-xl border border-zinc-300 px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-100"
              >
                Mở Trợ lý công việc
              </Link>
            </div>
          </SectionCard>

          <SectionCard title="Automation hôm nay" rightAction={<Badge text="Vận hành" tone="primary" />} className="p-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
                <p className="text-xs uppercase tracking-wide text-zinc-500">Đã gửi</p>
                <p className="text-xl font-semibold text-zinc-900">{automationStats.sent}</p>
              </div>
              <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
                <p className="text-xs uppercase tracking-wide text-zinc-500">Thất bại</p>
                <p className="text-xl font-semibold text-zinc-900">{automationStats.failed}</p>
              </div>
              <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
                <p className="text-xs uppercase tracking-wide text-zinc-500">Bỏ qua</p>
                <p className="text-xl font-semibold text-zinc-900">{automationStats.skipped}</p>
              </div>
            </div>
            <div className="mt-3">
              <Link
                href={`/automation/logs?status=failed&from=${today}&to=${today}`}
                className="inline-flex items-center rounded-xl border border-zinc-300 px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-100"
              >
                Xem lỗi
              </Link>
            </div>
          </SectionCard>

          <SectionCard title="Việc cần làm" rightAction={<Badge text="Thông báo" tone="accent" />} className="p-4">
            <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
              <p className="text-xs uppercase tracking-wide text-zinc-500">Mới + Đang xử lý</p>
              <p className="text-2xl font-semibold text-zinc-900">{todoCount}</p>
            </div>
            <div className="mt-3">
              <Link
                href="/notifications"
                className="inline-flex items-center rounded-xl border border-zinc-300 px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-100"
              >
                Mở hàng đợi thông báo
              </Link>
            </div>
          </SectionCard>
        </div>

        <div className="space-y-2">
          {automationStats.failed > 0 ? (
            <Alert
              type="error"
              message={`Có ${automationStats.failed} lượt chạy automation thất bại hôm nay. Mở nhật ký để kiểm tra nguyên nhân.`}
            />
          ) : null}
          {isAdmin && unassignedCount > 0 ? (
            <Alert
              type="info"
              message={`Có ${unassignedCount} khách chưa được gán người phụ trách hôm nay. Vào mục phân khách hàng để xử lý.`}
            />
          ) : null}
          {isAdmin && unassignedCount > 0 ? (
            <Link href="/admin/assign-leads" className="inline-flex text-sm text-blue-700 hover:underline">
              Đi tới phân khách hàng
            </Link>
          ) : null}
        </div>

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
            <p className="text-sm text-zinc-600">Không có dữ liệu.</p>
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

        <div className="text-xs text-zinc-500">
          Múi giờ hiển thị: Asia/Ho_Chi_Minh • Giờ hiện tại: {formatTimeHm(new Date())}
        </div>
      </div>
    </MobileShell >
  );
}
