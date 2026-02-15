"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { fetchJson, type ApiClientError } from "@/lib/api-client";
import { clearToken, fetchMe, getToken } from "@/lib/auth-client";
import { isAdminRole } from "@/lib/admin-auth";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Pagination } from "@/components/ui/pagination";
import { Spinner } from "@/components/ui/spinner";
import { Table } from "@/components/ui/table";
import { FilterCard } from "@/components/ui/filter-card";
import { PageHeader } from "@/components/ui/page-header";
import {
  firstDayOfMonthYmd,
  formatCurrencyVnd,
  formatDateTimeVi,
  formatTimeHms,
  getDateRangeYmd,
  shiftDateYmd,
  todayInHoChiMinh,
} from "@/lib/date-utils";

type KpiResponse = {
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

type MetricKey =
  | "leads.new"
  | "leads.hasPhone"
  | "telesale.called"
  | "telesale.appointed"
  | "telesale.arrived"
  | "telesale.signed"
  | "telesale.studying"
  | "telesale.examined"
  | "telesale.result"
  | "telesale.lost"
  | "finance.totalThu"
  | "finance.totalPhieuThu"
  | "finance.totalRemaining"
  | "finance.countPaid50";

type LeadItem = {
  id: string;
  fullName: string | null;
  phone: string | null;
  source: string | null;
  channel: string | null;
  licenseType: string | null;
  status: string;
  createdAt: string;
};

type LeadsListResponse = {
  items: LeadItem[];
  page: number;
  pageSize: number;
  total: number;
};

type RangeMode = "day" | "range";

function aggregateKpi(list: KpiResponse[]): KpiResponse {
  const baseDate = list[0]?.date || todayInHoChiMinh();
  return list.reduce<KpiResponse>(
    (acc, cur) => ({
      date: baseDate,
      leads: {
        new: acc.leads.new + cur.leads.new,
        hasPhone: acc.leads.hasPhone + cur.leads.hasPhone,
      },
      telesale: {
        called: acc.telesale.called + cur.telesale.called,
        appointed: acc.telesale.appointed + cur.telesale.appointed,
        arrived: acc.telesale.arrived + cur.telesale.arrived,
        signed: acc.telesale.signed + cur.telesale.signed,
        studying: acc.telesale.studying + cur.telesale.studying,
        examined: acc.telesale.examined + cur.telesale.examined,
        result: acc.telesale.result + cur.telesale.result,
        lost: acc.telesale.lost + cur.telesale.lost,
      },
      finance: {
        totalThu: acc.finance.totalThu + cur.finance.totalThu,
        totalPhieuThu: acc.finance.totalPhieuThu + cur.finance.totalPhieuThu,
        totalRemaining: acc.finance.totalRemaining + cur.finance.totalRemaining,
        countPaid50: acc.finance.countPaid50 + cur.finance.countPaid50,
      },
    }),
    {
      date: baseDate,
      leads: { new: 0, hasPhone: 0 },
      telesale: { called: 0, appointed: 0, arrived: 0, signed: 0, studying: 0, examined: 0, result: 0, lost: 0 },
      finance: { totalThu: 0, totalPhieuThu: 0, totalRemaining: 0, countPaid50: 0 },
    }
  );
}

function metricValue(kpi: KpiResponse | null, key: MetricKey) {
  if (!kpi) return 0;
  const [group, field] = key.split(".") as [keyof KpiResponse, string];
  const box = kpi[group] as Record<string, number>;
  return box[field] ?? 0;
}

function percentDiff(current: number, previous: number) {
  if (previous === 0) return current === 0 ? "0%" : "Không áp dụng";
  const pct = ((current - previous) / previous) * 100;
  return `${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%`;
}

function parseApiError(error: unknown) {
  const e = error as ApiClientError;
  return `${e.code || "INTERNAL_ERROR"}: ${e.message || "Lỗi không xác định"}`;
}

export default function KpiDailyPage() {
  const router = useRouter();
  const [mode, setMode] = useState<RangeMode>("day");
  const [date, setDate] = useState(todayInHoChiMinh());
  const [dateFrom, setDateFrom] = useState(todayInHoChiMinh());
  const [dateTo, setDateTo] = useState(todayInHoChiMinh());
  const [comparePrevDay, setComparePrevDay] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const [kpi, setKpi] = useState<KpiResponse | null>(null);
  const [previousKpi, setPreviousKpi] = useState<KpiResponse | null>(null);

  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState({ current: 0, total: 0 });

  const [drilldownOpen, setDrilldownOpen] = useState(false);
  const [drilldownTitle, setDrilldownTitle] = useState("");
  const [drilldownMetric, setDrilldownMetric] = useState<MetricKey | null>(null);
  const [drilldownData, setDrilldownData] = useState<LeadItem[]>([]);
  const [drilldownPage, setDrilldownPage] = useState(1);
  const [drilldownPageSize] = useState(20);
  const [drilldownTotal, setDrilldownTotal] = useState(0);
  const [drilldownLoading, setDrilldownLoading] = useState(false);
  const [canRunAutomation, setCanRunAutomation] = useState(false);
  const [automationRunning, setAutomationRunning] = useState(false);
  const [automationLogId, setAutomationLogId] = useState("");

  const dateList = useMemo(
    () => (mode === "day" ? [date] : getDateRangeYmd(dateFrom, dateTo)),
    [mode, date, dateFrom, dateTo]
  );

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

  const fetchDaily = useCallback(
    async (targetDate: string, token: string) => {
      return fetchJson<KpiResponse>(`/api/kpi/daily?date=${targetDate}`, { token });
    },
    []
  );

  const fetchRange = useCallback(
    async (dates: string[], token: string, onProgress?: (current: number, total: number) => void) => {
      const total = dates.length;
      let done = 0;
      const results: KpiResponse[] = [];
      const queue = [...dates];
      const workers = Array.from({ length: Math.min(3, dates.length) }).map(async () => {
        while (queue.length > 0) {
          const d = queue.shift();
          if (!d) return;
          const row = await fetchDaily(d, token);
          results.push(row);
          done += 1;
          onProgress?.(done, total);
        }
      });
      await Promise.all(workers);
      return results.sort((a, b) => a.date.localeCompare(b.date));
    },
    [fetchDaily]
  );

  const loadData = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    setLoading(true);
    setError("");
    try {
      if (mode === "day") {
        const data = await fetchDaily(date, token);
        setKpi(data);
        if (comparePrevDay) {
          const prev = await fetchDaily(shiftDateYmd(date, -1), token);
          setPreviousKpi(prev);
        } else {
          setPreviousKpi(null);
        }
      } else {
        const rows = await fetchRange(dateList, token);
        setKpi(aggregateKpi(rows));
        setPreviousKpi(null);
      }
      setLastUpdated(new Date());
    } catch (e) {
      const err = e as ApiClientError;
      if (!handleAuthError(err)) setError(`Lỗi tải KPI: ${parseApiError(err)}`);
    } finally {
      setLoading(false);
    }
  }, [comparePrevDay, date, dateList, fetchDaily, fetchRange, handleAuthError, mode]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (!autoRefresh) return;
    const timer = setInterval(() => {
      loadData();
    }, 60000);
    return () => clearInterval(timer);
  }, [autoRefresh, loadData]);

  useEffect(() => {
    fetchMe()
      .then((data) => setCanRunAutomation(isAdminRole(data.user.role)))
      .catch(() => setCanRunAutomation(false));
  }, []);

  async function runAutomationToday() {
    const token = getToken();
    if (!token) return;
    setAutomationRunning(true);
    setError("");
    setAutomationLogId("");
    try {
      const data = await fetchJson<{ log: { id: string } }>("/api/automation/run", {
        method: "POST",
        token,
        body: { scope: "daily", dryRun: false },
      });
      setAutomationLogId(data.log.id);
    } catch (e) {
      const err = e as ApiClientError;
      if (!handleAuthError(err)) setError(`Lỗi chạy automation: ${parseApiError(err)}`);
    } finally {
      setAutomationRunning(false);
    }
  }

  async function loadDrilldown(metric: MetricKey, page: number) {
    const token = getToken();
    if (!token) return;
    setDrilldownLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("pageSize", String(drilldownPageSize));
      params.set("sort", "createdAt");
      params.set("order", "desc");

      const from = mode === "day" ? date : dateFrom;
      const to = mode === "day" ? date : dateTo;
      params.set("createdFrom", from);
      params.set("createdTo", to);

      const statusMap: Partial<Record<MetricKey, string>> = {
        "leads.hasPhone": "HAS_PHONE",
        "telesale.called": "HAS_PHONE",
        "telesale.appointed": "APPOINTED",
        "telesale.arrived": "ARRIVED",
        "telesale.signed": "SIGNED",
        "telesale.studying": "STUDYING",
        "telesale.examined": "EXAMED",
        "telesale.result": "RESULT",
        "telesale.lost": "LOST",
      };

      if (statusMap[metric]) params.set("status", statusMap[metric]!);

      const data = await fetchJson<LeadsListResponse>(`/api/leads?${params.toString()}`, { token });
      setDrilldownData(data.items);
      setDrilldownTotal(data.total);
      setDrilldownPage(page);
    } catch (e) {
      const err = e as ApiClientError;
      if (!handleAuthError(err)) setError(`Lỗi tải danh sách khách: ${parseApiError(err)}`);
    } finally {
      setDrilldownLoading(false);
    }
  }

  function openDrilldown(metric: MetricKey, title: string) {
    setDrilldownMetric(metric);
    setDrilldownTitle(title);
    setDrilldownOpen(true);
    loadDrilldown(metric, 1);
  }

  async function exportCsv() {
    const token = getToken();
    if (!token) return;
    setExporting(true);
    setError("");
    try {
      const rows =
        mode === "day"
          ? [await fetchDaily(date, token)]
          : await fetchRange(dateList, token, (current, total) => setExportProgress({ current, total }));

      const header = [
        "Ngày",
        "Khách mới",
        "Đã có SĐT",
        "Đã gọi",
        "Đã hẹn",
        "Đã đến",
        "Đã ký",
        "Đang học",
        "Đã thi",
        "Đậu",
        "Rớt",
        "Tổng thu",
        "Tổng phiếu thu",
        "Còn phải thu",
        "Đã đóng >=50%",
      ];

      const body = rows.map((row) =>
        [
          row.date,
          row.leads.new,
          row.leads.hasPhone,
          row.telesale.called,
          row.telesale.appointed,
          row.telesale.arrived,
          row.telesale.signed,
          row.telesale.studying,
          row.telesale.examined,
          row.telesale.result,
          row.telesale.lost,
          row.finance.totalThu,
          row.finance.totalPhieuThu,
          row.finance.totalRemaining,
          row.finance.countPaid50,
        ].join(",")
      );

      const csv = [header.join(","), ...body].join("\n");
      const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `bao-cao-kpi-${mode === "day" ? date : `${dateFrom}-den-${dateTo}`}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      const err = e as ApiClientError;
      if (!handleAuthError(err)) setError(`Lỗi xuất CSV: ${parseApiError(err)}`);
    } finally {
      setExporting(false);
      setExportProgress({ current: 0, total: 0 });
    }
  }

  const cardDefs: Array<{ label: string; key: MetricKey }> = [
    { label: "Khách mới", key: "leads.new" },
    { label: "Đã có SĐT", key: "leads.hasPhone" },
    { label: "Đã gọi", key: "telesale.called" },
    { label: "Đã hẹn", key: "telesale.appointed" },
    { label: "Đã đến", key: "telesale.arrived" },
    { label: "Đã ký", key: "telesale.signed" },
    { label: "Đang học", key: "telesale.studying" },
    { label: "Đã thi", key: "telesale.examined" },
    { label: "Đậu", key: "telesale.result" },
    { label: "Rớt", key: "telesale.lost" },
    { label: "Tổng thu", key: "finance.totalThu" },
    { label: "Tổng phiếu thu", key: "finance.totalPhieuThu" },
    { label: "Còn phải thu", key: "finance.totalRemaining" },
    { label: "Đã đóng >=50%", key: "finance.countPaid50" },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Báo cáo KPI ngày"
        subtitle={lastUpdated ? `Cập nhật lần cuối: ${formatTimeHms(lastUpdated)}` : "Chưa có dữ liệu cập nhật"}
        actions={
          <>
            <Button variant="secondary" onClick={loadData} disabled={loading}>
              {loading ? (
                <span className="flex items-center gap-2">
                  <Spinner /> Đang tải...
                </span>
              ) : (
                "Làm mới"
              )}
            </Button>
            <Button variant="secondary" onClick={exportCsv} disabled={exporting}>
              {exporting ? "Đang xuất..." : "Xuất CSV"}
            </Button>
            {canRunAutomation ? (
              <Button onClick={runAutomationToday} disabled={automationRunning}>
                {automationRunning ? "Đang chạy..." : "Chạy Automation hôm nay"}
              </Button>
            ) : null}
          </>
        }
      />

      <FilterCard>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1">
            <label className="text-sm text-zinc-700">Chế độ thời gian</label>
            <select
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm"
              value={mode}
              onChange={(e) => setMode(e.target.value as RangeMode)}
            >
              <option value="day">Theo ngày</option>
              <option value="range">Theo khoảng</option>
            </select>
          </div>

          {mode === "day" ? (
            <div className="space-y-1">
              <label className="text-sm text-zinc-700">Ngày</label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          ) : (
            <>
              <div className="space-y-1">
                <label className="text-sm text-zinc-700">Từ ngày</label>
                <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
              </div>
              <div className="space-y-1">
                <label className="text-sm text-zinc-700">Đến ngày</label>
                <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
              </div>
            </>
          )}

          <div className="flex items-end">
            <label className="flex items-center gap-2 text-sm text-zinc-700">
              <input type="checkbox" checked={autoRefresh} onChange={(e) => setAutoRefresh(e.target.checked)} />
              Tự làm mới (60 giây)
            </label>
          </div>

          {mode === "day" ? (
            <div className="flex items-end">
              <label className="flex items-center gap-2 text-sm text-zinc-700">
                <input
                  type="checkbox"
                  checked={comparePrevDay}
                  onChange={(e) => setComparePrevDay(e.target.checked)}
                />
                So sánh với hôm trước
              </label>
            </div>
          ) : null}
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            variant="secondary"
            onClick={() => {
              const t = todayInHoChiMinh();
              setMode("day");
              setDate(t);
            }}
          >
            Hôm nay
          </Button>
          <Button
            variant="secondary"
            onClick={() => {
              const t = shiftDateYmd(todayInHoChiMinh(), -1);
              setMode("day");
              setDate(t);
            }}
          >
            Hôm qua
          </Button>
          <Button
            variant="secondary"
            onClick={() => {
              const t = todayInHoChiMinh();
              setMode("range");
              setDateTo(t);
              setDateFrom(shiftDateYmd(t, -6));
            }}
          >
            7 ngày gần nhất
          </Button>
          <Button
            variant="secondary"
            onClick={() => {
              const t = todayInHoChiMinh();
              setMode("range");
              setDateTo(t);
              setDateFrom(firstDayOfMonthYmd(t));
            }}
          >
            Tháng này
          </Button>
        </div>
      </FilterCard>

      {exporting && mode === "range" ? (
        <Alert
          type="info"
          message={`Đang xuất... (${exportProgress.current}/${exportProgress.total || dateList.length})`}
        />
      ) : null}

      {error ? <Alert type="error" message={error} /> : null}
      {automationLogId ? (
        <Alert
          type="success"
          message="Đã chạy automation hôm nay thành công."
        />
      ) : null}
      {automationLogId ? (
        <div>
          <Link
            href={`/automation/logs?scope=daily&hl=${automationLogId}`}
            className="inline-block rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-100"
          >
            Xem nhật ký automation
          </Link>
        </div>
      ) : null}

      {loading && !kpi ? (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 12 }).map((_, idx) => (
            <div key={idx} className="h-24 animate-pulse rounded-xl bg-zinc-200" />
          ))}
        </div>
      ) : null}

      {kpi ? (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          {cardDefs.map((card) => {
            const current = metricValue(kpi, card.key);
            const previous = metricValue(previousKpi, card.key);
            const showCompare = mode === "day" && comparePrevDay;
            const isMoneyMetric = card.key === "finance.totalThu" || card.key === "finance.totalRemaining";
            return (
              <button
                key={card.key}
                onClick={() => openDrilldown(card.key, card.label)}
                className="rounded-xl bg-white p-4 text-left shadow-sm transition hover:shadow-md"
              >
                <div className="flex items-center justify-between">
                  <p className="text-sm text-zinc-500">{card.label}</p>
                  <Badge text="Xem chi tiết" />
                </div>
                <p className="mt-2 text-2xl font-semibold text-zinc-900">
                  {isMoneyMetric ? formatCurrencyVnd(current) : current.toLocaleString("vi-VN")}
                </p>
                {showCompare ? (
                  <p className="mt-1 text-xs text-zinc-500">
                    So với hôm trước: {percentDiff(current, previous)} ({isMoneyMetric ? formatCurrencyVnd(previous) : previous.toLocaleString("vi-VN")})
                  </p>
                ) : null}
              </button>
            );
          })}
        </div>
      ) : null}

      <Modal open={drilldownOpen} title="Danh sách khách" onClose={() => setDrilldownOpen(false)}>
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-sm text-zinc-600">Chỉ số:</span>
            <Badge text={drilldownTitle || "-"} />
          </div>

          {drilldownLoading ? (
            <div className="flex items-center gap-2 text-sm text-zinc-600">
              <Spinner /> Đang tải danh sách...
            </div>
          ) : drilldownData.length === 0 ? (
            <div className="rounded-lg bg-zinc-50 p-3 text-sm text-zinc-500">Không có dữ liệu khách trong phạm vi đã chọn.</div>
          ) : (
            <Table headers={["Họ tên", "SĐT", "Nguồn", "Kênh", "Hạng bằng", "Trạng thái", "Ngày tạo", ""]}>
              {drilldownData.map((lead) => (
                <tr key={lead.id} className="border-t border-zinc-100">
                  <td className="px-3 py-2">{lead.fullName || "-"}</td>
                  <td className="px-3 py-2">{lead.phone || "-"}</td>
                  <td className="px-3 py-2">{lead.source || "-"}</td>
                  <td className="px-3 py-2">{lead.channel || "-"}</td>
                  <td className="px-3 py-2">{lead.licenseType || "-"}</td>
                  <td className="px-3 py-2">
                    <Badge text={lead.status} />
                  </td>
                  <td className="px-3 py-2 text-xs text-zinc-600">{formatDateTimeVi(lead.createdAt)}</td>
                  <td className="px-3 py-2">
                    <Link
                      href={`/leads/${lead.id}`}
                      className="rounded-lg border border-zinc-300 bg-white px-2 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-100"
                    >
                      Mở
                    </Link>
                  </td>
                </tr>
              ))}
            </Table>
          )}

          <Pagination
            page={drilldownPage}
            pageSize={drilldownPageSize}
            total={drilldownTotal}
            onPageChange={(next) => {
              if (!drilldownMetric) return;
              setDrilldownPage(next);
              loadDrilldown(drilldownMetric, next);
            }}
          />
        </div>
      </Modal>
    </div>
  );
}
