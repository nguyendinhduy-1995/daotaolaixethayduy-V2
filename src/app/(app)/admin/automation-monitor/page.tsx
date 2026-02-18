"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { Table } from "@/components/ui/table";
import { fetchJson, type ApiClientError } from "@/lib/api-client";
import { clearToken, getToken } from "@/lib/auth-client";
import { formatDateTimeVi, todayInHoChiMinh } from "@/lib/date-utils";

type OverviewResponse = {
  dateKey: string;
  monthKey: string;
  jobs: {
    today: Record<"NEW" | "DISPATCHED" | "DONE" | "FAILED", number>;
    month: Record<"NEW" | "DISPATCHED" | "DONE" | "FAILED", number>;
  };
  logs: {
    todayByMilestone: Array<{ milestone: string; count: number }>;
    monthByMilestone: Array<{ milestone: string; count: number }>;
  };
};

type AutomationJob = {
  id: string;
  title: string;
  status: "NEW" | "DISPATCHED" | "DONE" | "FAILED";
  runId: string | null;
  lastError: string | null;
  branchId: string;
  ownerId: string | null;
  suggestionId: string | null;
  taskId: string | null;
  metaJson: Record<string, unknown> | null;
  payloadJson: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
  dispatchedAt: string | null;
  doneAt: string | null;
  branch?: { id: string; name: string };
  owner?: { id: string; name: string | null; email: string } | null;
  suggestion?: { id: string; title: string } | null;
  task?: { id: string; title: string; status: string; updatedAt: string } | null;
};

type JobsResponse = {
  items: AutomationJob[];
  dateKey: string;
  total: number;
};

type AutomationLogItem = {
  id: string;
  branchId: string;
  channel: string;
  milestone: string | null;
  status: string;
  sentAt: string;
  payload: Record<string, unknown> | null;
};

type LogsResponse = {
  items: AutomationLogItem[];
  dateKey: string;
  total: number;
};

type ErrorsResponse = {
  items: Array<{ message: string; count: number; lastSeenAt: string; exampleRunId: string | null }>;
  dateKey: string;
  total: number;
};

function statusLabel(status: AutomationJob["status"]) {
  if (status === "NEW") return "Mới";
  if (status === "DISPATCHED") return "Đã gửi đi";
  if (status === "DONE") return "Hoàn tất";
  return "Lỗi";
}

function statusTone(status: AutomationJob["status"]) {
  if (status === "DONE") return "text-emerald-700 bg-emerald-50 border-emerald-200";
  if (status === "FAILED") return "text-rose-700 bg-rose-50 border-rose-200";
  if (status === "DISPATCHED") return "text-blue-700 bg-blue-50 border-blue-200";
  return "text-amber-700 bg-amber-50 border-amber-200";
}

function apiErrorText(error: unknown) {
  const e = error as ApiClientError;
  return `${e.code || "INTERNAL_ERROR"}: ${e.message || "Lỗi không xác định"}`;
}

export default function AutomationMonitorPage() {
  const router = useRouter();
  const [date, setDate] = useState(todayInHoChiMinh());
  const [branchId, setBranchId] = useState("");
  const [status, setStatus] = useState("");
  const [channel, setChannel] = useState("");
  const [runId, setRunId] = useState("");

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [overview, setOverview] = useState<OverviewResponse | null>(null);
  const [errorsTop, setErrorsTop] = useState<ErrorsResponse["items"]>([]);
  const [jobs, setJobs] = useState<AutomationJob[]>([]);

  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedJob, setSelectedJob] = useState<AutomationJob | null>(null);
  const [detailLogs, setDetailLogs] = useState<AutomationLogItem[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  const milestonesToday = useMemo(() => overview?.logs.todayByMilestone || [], [overview]);
  const milestonesMonth = useMemo(() => overview?.logs.monthByMilestone || [], [overview]);

  const loadAll = useCallback(async () => {
    const token = getToken();
    if (!token) {
      router.replace("/login");
      return;
    }

    setError("");
    setRefreshing(true);
    try {
      const [overviewRes, errorsRes, jobsRes] = await Promise.all([
        fetchJson<OverviewResponse>(`/api/admin/automation/overview?date=${date}`, { token }),
        fetchJson<ErrorsResponse>(`/api/admin/automation/errors?date=${date}&limit=5`, { token }),
        fetchJson<JobsResponse>(
          `/api/admin/automation/jobs?date=${date}&limit=50${status ? `&status=${status}` : ""}${branchId ? `&branchId=${branchId}` : ""}${channel ? `&channel=${channel}` : ""}${runId ? `&runId=${encodeURIComponent(runId)}` : ""}`,
          { token }
        ),
      ]);

      setOverview(overviewRes);
      setErrorsTop(errorsRes.items || []);
      setJobs(jobsRes.items || []);
    } catch (e) {
      const err = e as ApiClientError;
      if (err.code === "AUTH_MISSING_BEARER" || err.code === "AUTH_INVALID_TOKEN") {
        clearToken();
        router.replace("/login");
        return;
      }
      setError(apiErrorText(e));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [branchId, channel, date, router, runId, status]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const openDetail = useCallback(
    async (job: AutomationJob) => {
      setSelectedJob(job);
      setDetailOpen(true);
      setDetailLoading(true);
      const token = getToken();
      if (!token) {
        setDetailLogs([]);
        setDetailLoading(false);
        return;
      }

      try {
        const params = new URLSearchParams({
          date,
          limit: "100",
        });
        if (job.runId) params.set("runId", job.runId);
        if (job.suggestionId) params.set("suggestionId", job.suggestionId);
        params.set("outboundJobId", job.id);

        const logsRes = await fetchJson<LogsResponse>(`/api/admin/automation/logs?${params.toString()}`, { token });
        setDetailLogs(logsRes.items || []);
      } catch {
        setDetailLogs([]);
      } finally {
        setDetailLoading(false);
      }
    },
    [date]
  );

  return (
    <div className="space-y-4">
      {/* ── Premium Header ── */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-amber-600 via-orange-600 to-red-500 p-4 text-white shadow-lg shadow-amber-200 animate-fadeInUp">
        <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-white/10 blur-2xl" />
        <div className="absolute -bottom-4 -left-4 h-20 w-20 rounded-full bg-white/10 blur-xl" />
        <div className="relative flex flex-wrap items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/20 text-2xl backdrop-blur-sm">📊</div>
          <div className="flex-1">
            <h2 className="text-lg font-bold">Giám sát luồng tự động</h2>
            <p className="text-sm text-white/80">Theo dõi job gọi nhắc, lỗi nổi bật và nhật ký luồng trong ngày</p>
          </div>
          <Button variant="secondary" onClick={() => void loadAll()} disabled={refreshing} className="!bg-white/20 !text-white !border-white/30 hover:!bg-white/30">
            {refreshing ? "Đang làm mới..." : "🔄 Làm mới"}
          </Button>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-zinc-100 bg-white shadow-sm animate-fadeInUp" style={{ animationDelay: "80ms" }}>
        <div className="h-1 bg-gradient-to-r from-amber-500 to-orange-500" />
        <div className="p-4">
          <h3 className="text-sm font-semibold text-zinc-800 mb-3">🔍 Bộ lọc</h3>
          <div className="grid gap-3 md:grid-cols-5">
            <label className="space-y-1 text-sm text-zinc-700">
              <span>Ngày</span>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </label>
            <label className="space-y-1 text-sm text-zinc-700">
              <span>Mã chi nhánh</span>
              <Input placeholder="Nhập mã chi nhánh" value={branchId} onChange={(e) => setBranchId(e.target.value.trim())} />
            </label>
            <label className="space-y-1 text-sm text-zinc-700">
              <span>Trạng thái</span>
              <Select value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="">Tất cả</option>
                <option value="NEW">Mới</option>
                <option value="DISPATCHED">Đã gửi đi</option>
                <option value="DONE">Hoàn tất</option>
                <option value="FAILED">Lỗi</option>
              </Select>
            </label>
            <label className="space-y-1 text-sm text-zinc-700">
              <span>Kênh</span>
              <Select value={channel} onChange={(e) => setChannel(e.target.value)}>
                <option value="">Tất cả</option>
                <option value="CALL_NOTE">Gọi nhắc</option>
                <option value="SMS">SMS</option>
                <option value="ZALO">Zalo</option>
                <option value="FB">Facebook</option>
              </Select>
            </label>
            <label className="space-y-1 text-sm text-zinc-700">
              <span>Mã lượt chạy</span>
              <Input placeholder="Nhập mã lượt chạy" value={runId} onChange={(e) => setRunId(e.target.value)} />
            </label>
          </div>
        </div>
      </div>

      {error ? <Alert type="error" message={error} /> : null}

      {loading ? (
        <div className="animate-pulse space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-3 rounded-xl bg-white p-3 shadow-sm">
              <div className="h-8 w-8 rounded-lg bg-zinc-200" />
              <div className="flex-1 space-y-2"><div className="h-4 w-1/4 rounded bg-zinc-200" /><div className="h-3 w-1/3 rounded bg-zinc-100" /></div>
              <div className="h-6 w-16 rounded-full bg-zinc-200" />
            </div>
          ))}
        </div>
      ) : (
        <>
          <section className="overflow-hidden rounded-2xl border border-zinc-100 bg-white shadow-sm animate-fadeInUp" style={{ animationDelay: "160ms" }}>
            <div className="h-1 bg-gradient-to-r from-amber-500 to-orange-500" />
            <div className="p-4">
              <h2 className="text-base font-semibold text-zinc-900">📋 Tổng quan (hôm nay + tháng này)</h2>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3">
                  <p className="text-sm font-semibold text-zinc-800">Việc gọi nhắc hôm nay</p>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-sm text-zinc-700">
                    <p>Mới: {overview?.jobs.today.NEW ?? 0}</p>
                    <p>Đã gửi đi: {overview?.jobs.today.DISPATCHED ?? 0}</p>
                    <p>Hoàn tất: {overview?.jobs.today.DONE ?? 0}</p>
                    <p>Lỗi: {overview?.jobs.today.FAILED ?? 0}</p>
                  </div>
                </div>
                <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3">
                  <p className="text-sm font-semibold text-zinc-800">Việc gọi nhắc tháng này</p>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-sm text-zinc-700">
                    <p>Mới: {overview?.jobs.month.NEW ?? 0}</p>
                    <p>Đã gửi đi: {overview?.jobs.month.DISPATCHED ?? 0}</p>
                    <p>Hoàn tất: {overview?.jobs.month.DONE ?? 0}</p>
                    <p>Lỗi: {overview?.jobs.month.FAILED ?? 0}</p>
                  </div>
                </div>
              </div>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <div className="rounded-xl border border-zinc-200 p-3">
                  <p className="text-sm font-semibold text-zinc-800">Nhật ký tự động hôm nay theo mốc xử lý</p>
                  <div className="mt-2 space-y-1 text-sm text-zinc-700">
                    {milestonesToday.length === 0 ? <p>Chưa có dữ liệu</p> : milestonesToday.map((x) => <p key={`today-${x.milestone}`}>- {x.milestone}: {x.count}</p>)}
                  </div>
                </div>
                <div className="rounded-xl border border-zinc-200 p-3">
                  <p className="text-sm font-semibold text-zinc-800">Nhật ký tự động tháng này theo mốc xử lý</p>
                  <div className="mt-2 space-y-1 text-sm text-zinc-700">
                    {milestonesMonth.length === 0 ? <p>Chưa có dữ liệu</p> : milestonesMonth.map((x) => <p key={`month-${x.milestone}`}>- {x.milestone}: {x.count}</p>)}
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="overflow-hidden rounded-2xl border border-zinc-100 bg-white shadow-sm animate-fadeInUp" style={{ animationDelay: "240ms" }}>
            <div className="h-1 bg-gradient-to-r from-rose-500 to-red-500" />
            <div className="p-4">
              <h2 className="text-base font-semibold text-zinc-900">⚠️ Lỗi nổi bật</h2>
              <div className="mt-3 space-y-2">
                {errorsTop.length === 0 ? (
                  <p className="text-sm text-zinc-600">Không có lỗi nổi bật trong ngày đã chọn.</p>
                ) : (
                  errorsTop.map((row, idx) => (
                    <div key={`err-${idx}`} className="rounded-xl border border-rose-200 bg-rose-50/70 p-3 text-sm text-rose-900">
                      <p className="font-medium">{row.message}</p>
                      <p className="mt-1 text-xs text-rose-800">Số lần: {row.count} | Gần nhất: {formatDateTimeVi(row.lastSeenAt)}{row.exampleRunId ? ` | runId: ${row.exampleRunId}` : ""}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </section>

          <section className="overflow-hidden rounded-2xl border border-zinc-100 bg-white shadow-sm animate-fadeInUp" style={{ animationDelay: "320ms" }}>
            <div className="h-1 bg-gradient-to-r from-orange-500 to-amber-500" />
            <div className="p-4">
              <h2 className="text-base font-semibold text-zinc-900">📡 Việc gọi nhắc gần đây</h2>
              <p className="mt-1 text-xs text-zinc-500">Hiển thị tối đa 50 OutboundJob theo bộ lọc.</p>
              <div className="mt-3 hidden md:block">
                <Table headers={["Thời gian", "Tiêu đề", "Trạng thái", "Chi nhánh", "Kênh", "Mã lượt chạy", "Chi tiết"]}>
                  {jobs.map((job, idx) => (
                    <tr key={job.id} className="border-t border-zinc-100 transition-colors hover:bg-zinc-50 animate-fadeInUp" style={{ animationDelay: `${320 + Math.min(idx * 30, 200)}ms` }}>
                      <td className="px-3 py-2 text-sm text-zinc-700">{formatDateTimeVi(job.createdAt)}</td>
                      <td className="px-3 py-2 text-sm text-zinc-900">{job.title}</td>
                      <td className="px-3 py-2 text-sm">
                        <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${statusTone(job.status)}`}>{statusLabel(job.status)}</span>
                      </td>
                      <td className="px-3 py-2 text-sm text-zinc-700">{job.branch?.name || job.branchId}</td>
                      <td className="px-3 py-2 text-sm text-zinc-700">{String((job.payloadJson || {})["channel"] || "-")}</td>
                      <td className="px-3 py-2 text-xs text-zinc-600">{job.runId || "-"}</td>
                      <td className="px-3 py-2 text-sm">
                        <Button variant="secondary" className="h-8 px-2 text-xs" onClick={() => void openDetail(job)}>
                          Xem
                        </Button>
                      </td>
                    </tr>
                  ))}
                </Table>
              </div>

              <div className="mt-3 space-y-2 md:hidden">
                {jobs.length === 0 ? <p className="text-sm text-zinc-600">Không có job phù hợp.</p> : null}
                {jobs.map((job) => (
                  <button
                    key={`m-${job.id}`}
                    type="button"
                    onClick={() => void openDetail(job)}
                    className="w-full rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-left"
                  >
                    <p className="text-sm font-semibold text-zinc-900">{job.title}</p>
                    <p className="mt-1 text-xs text-zinc-600">{formatDateTimeVi(job.createdAt)} • {job.branch?.name || job.branchId}</p>
                    <p className="mt-1 text-xs text-zinc-600">Trạng thái: {statusLabel(job.status)} • Kênh: {String((job.payloadJson || {})["channel"] || "-")}</p>
                  </button>
                ))}
              </div>
            </div>
          </section>
        </>
      )}

      <Modal
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        title="Chi tiết luồng gọi nhắc"
        description={selectedJob ? `${selectedJob.title} (${selectedJob.id})` : ""}
      >
        {!selectedJob ? null : (
          <div className="space-y-3 text-sm text-zinc-700">
            <div className="grid gap-2 md:grid-cols-2">
              <p><span className="font-medium text-zinc-900">Trạng thái:</span> {statusLabel(selectedJob.status)}</p>
              <p><span className="font-medium text-zinc-900">Chi nhánh:</span> {selectedJob.branch?.name || selectedJob.branchId}</p>
              <p><span className="font-medium text-zinc-900">Mã lượt chạy:</span> {selectedJob.runId || "-"}</p>
              <p><span className="font-medium text-zinc-900">Mã việc:</span> {selectedJob.taskId || "-"}</p>
              <p><span className="font-medium text-zinc-900">Mã gợi ý:</span> {selectedJob.suggestionId || "-"}</p>
              <p><span className="font-medium text-zinc-900">Cập nhật:</span> {formatDateTimeVi(selectedJob.updatedAt)}</p>
              <p><span className="font-medium text-zinc-900">Gửi đi:</span> {selectedJob.dispatchedAt ? formatDateTimeVi(selectedJob.dispatchedAt) : "-"}</p>
              <p><span className="font-medium text-zinc-900">Hoàn tất:</span> {selectedJob.doneAt ? formatDateTimeVi(selectedJob.doneAt) : "-"}</p>
            </div>

            <div>
              <p className="mb-1 font-medium text-zinc-900">Thông tin bổ sung</p>
              <pre className="overflow-auto rounded-xl bg-zinc-900 p-3 text-xs text-zinc-100">{JSON.stringify(selectedJob.metaJson || {}, null, 2)}</pre>
            </div>

            <div>
              <p className="mb-1 font-medium text-zinc-900">Dữ liệu gửi đi</p>
              <pre className="overflow-auto rounded-xl bg-zinc-900 p-3 text-xs text-zinc-100">{JSON.stringify(selectedJob.payloadJson || {}, null, 2)}</pre>
            </div>

            <div>
              <p className="mb-1 font-medium text-zinc-900">4) Nhật ký liên quan</p>
              {detailLoading ? (
                <p className="text-sm text-zinc-600">Đang tải log...</p>
              ) : detailLogs.length === 0 ? (
                <p className="text-sm text-zinc-600">Chưa có log liên quan.</p>
              ) : (
                <div className="space-y-2">
                  {detailLogs.map((log) => (
                    <div key={log.id} className="rounded-xl border border-zinc-200 p-2">
                      <p className="text-xs text-zinc-500">{formatDateTimeVi(log.sentAt)} • {log.channel} • {log.status}</p>
                      <p className="text-sm text-zinc-900">{log.milestone || "(không milestone)"}</p>
                      <pre className="mt-1 overflow-auto rounded-lg bg-zinc-50 p-2 text-xs text-zinc-700">{JSON.stringify(log.payload || {}, null, 2)}</pre>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
