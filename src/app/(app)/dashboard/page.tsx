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
import {
  formatCurrencyVnd,
  formatDateTimeVi,
  formatTimeHms,
  formatTimeHm,
  todayInHoChiMinh,
} from "@/lib/date-utils";

type KpiDaily = {
  date: string;
  leads: { new: number; hasPhone: number };
  telesale: {
    called: number;
    appointed: number;
    arrived: number;
    signed: number;
    studying: number;
    examined: number;
    result: number;
    lost: number;
  };
  finance: {
    totalThu: number;
    totalPhieuThu: number;
    totalRemaining: number;
    countPaid50: number;
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

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

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
    const pageSize = 100;
    let page = 1;
    let total = 0;
    let seen = 0;

    while (true) {
      const params = new URLSearchParams({
        createdFrom: date,
        createdTo: date,
        page: String(page),
        pageSize: String(pageSize),
        sort: "createdAt",
        order: "desc",
      });
      const data = await fetchJson<LeadsResponse>(`/api/leads?${params.toString()}`, { token });
      seen += data.items.length;
      total += data.items.filter((item) => !item.ownerId).length;
      if (seen >= data.total || data.items.length === 0) break;
      page += 1;
    }
    return total;
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

      const [me, kpiData, receiptData, statusData, logsData, todoNew, todoDoing] = await Promise.all([
        mePromise,
        kpiPromise,
        receiptsPromise,
        Promise.all(statusPromises),
        logsPromise,
        todoNewPromise,
        todoDoingPromise,
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
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900">Tổng quan hôm nay</h1>
          <p className="text-sm text-zinc-600">
            Ngày {today} {lastUpdated ? `• Cập nhật lần cuối: ${formatTimeHms(lastUpdated)}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-700">
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
        </div>
      </div>

      {error ? <Alert type="error" message={`Có lỗi xảy ra: ${error}`} /> : null}

      {!isAdmin && (isTelesales || user) ? (
        <Alert type="info" message="Bạn đang xem dữ liệu trong phạm vi quyền được cấp." />
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-semibold text-zinc-900">Khách hàng hôm nay</h2>
            <Badge text="Khách hàng" />
          </div>
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
        </section>

        <section className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-semibold text-zinc-900">Telesales hôm nay</h2>
            <Badge text="KPI" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <button type="button" onClick={() => openDrilldown("HAS_PHONE", "Đã gọi")} className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-left hover:bg-zinc-100">
              <p className="text-xs uppercase tracking-wide text-zinc-500">Đã gọi</p>
              <p className="text-xl font-semibold text-zinc-900">{kpi?.telesale.called ?? 0}</p>
            </button>
            <button type="button" onClick={() => openDrilldown("APPOINTED", "Đã hẹn")} className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-left hover:bg-zinc-100">
              <p className="text-xs uppercase tracking-wide text-zinc-500">Đã hẹn</p>
              <p className="text-xl font-semibold text-zinc-900">{kpi?.telesale.appointed ?? 0}</p>
            </button>
            <button type="button" onClick={() => openDrilldown("ARRIVED", "Đã đến")} className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-left hover:bg-zinc-100">
              <p className="text-xs uppercase tracking-wide text-zinc-500">Đã đến</p>
              <p className="text-xl font-semibold text-zinc-900">{kpi?.telesale.arrived ?? 0}</p>
            </button>
            <button type="button" onClick={() => openDrilldown("SIGNED", "Đã ký")} className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-left hover:bg-zinc-100">
              <p className="text-xs uppercase tracking-wide text-zinc-500">Đã ký</p>
              <p className="text-xl font-semibold text-zinc-900">{kpi?.telesale.signed ?? 0}</p>
            </button>
          </div>
        </section>

        <section className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-semibold text-zinc-900">Tài chính hôm nay</h2>
            <Badge text="Thu tiền" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
              <p className="text-xs uppercase tracking-wide text-zinc-500">Tổng thu</p>
              <p className="text-xl font-semibold text-zinc-900">
                {formatCurrencyVnd(receiptsSummary?.totalThu ?? kpi?.finance.totalThu ?? 0)}
              </p>
            </div>
            <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
              <p className="text-xs uppercase tracking-wide text-zinc-500">Tổng phiếu thu</p>
              <p className="text-xl font-semibold text-zinc-900">
                {receiptsSummary?.totalPhieuThu ?? kpi?.finance.totalPhieuThu ?? 0}
              </p>
            </div>
            <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
              <p className="text-xs uppercase tracking-wide text-zinc-500">Còn phải thu</p>
              <p className="text-xl font-semibold text-zinc-900">{formatCurrencyVnd(kpi?.finance.totalRemaining ?? 0)}</p>
            </div>
            <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
              <p className="text-xs uppercase tracking-wide text-zinc-500">Đã đóng &gt;= 50%</p>
              <p className="text-xl font-semibold text-zinc-900">{kpi?.finance.countPaid50 ?? 0}</p>
            </div>
          </div>
          <div className="mt-3">
            <Link
              href={`/receipts?from=${today}&to=${today}`}
              className="inline-flex items-center rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-100"
            >
              Mở danh sách phiếu thu hôm nay
            </Link>
          </div>
        </section>

        <section className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-semibold text-zinc-900">Automation hôm nay</h2>
            <Badge text="Vận hành" />
          </div>
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
              className="inline-flex items-center rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-100"
            >
              Xem lỗi
            </Link>
          </div>
        </section>

        <section className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-semibold text-zinc-900">Việc cần làm</h2>
            <Badge text="Thông báo" />
          </div>
          <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
            <p className="text-xs uppercase tracking-wide text-zinc-500">Mới + Đang xử lý</p>
            <p className="text-2xl font-semibold text-zinc-900">{todoCount}</p>
          </div>
          <div className="mt-3">
            <Link
              href="/notifications"
              className="inline-flex items-center rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-100"
            >
              Mở hàng đợi thông báo
            </Link>
          </div>
        </section>
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
  );
}
