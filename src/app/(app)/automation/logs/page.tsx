"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { fetchJson, type ApiClientError } from "@/lib/api-client";
import { clearToken, fetchMe, getToken } from "@/lib/auth-client";
import { isAdminRole } from "@/lib/admin-auth";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Pagination } from "@/components/ui/pagination";
import { Select } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Table } from "@/components/ui/table";
import { formatDateTimeVi } from "@/lib/date-utils";

type AutomationLog = {
  id: string;
  leadId: string | null;
  studentId: string | null;
  milestone: string;
  status: string;
  sentAt: string;
  payload: unknown;
};

type LogsResponse = {
  items: AutomationLog[];
  page: number;
  pageSize: number;
  total: number;
};

type PayloadMeta = {
  runtimeStatus?: string;
  input?: { scope?: string; leadId?: string | null; studentId?: string | null; dryRun?: boolean };
  output?: unknown;
  error?: unknown;
};

function parsePayload(payload: unknown): PayloadMeta {
  if (!payload || typeof payload !== "object") return {};
  return payload as PayloadMeta;
}

function runtimeLabel(value: string | undefined) {
  if (value === "queued") return "Đang chờ";
  if (value === "running") return "Đang chạy";
  if (value === "success") return "Thành công";
  if (value === "failed") return "Thất bại";
  return "-";
}

function statusLabel(value: string) {
  if (value === "sent") return "Đã gửi";
  if (value === "failed") return "Thất bại";
  if (value === "skipped") return "Bỏ qua";
  return value;
}

function shortError(payload: PayloadMeta) {
  if (!payload.error) return "-";
  if (typeof payload.error === "string") return payload.error.slice(0, 120);
  return JSON.stringify(payload.error).slice(0, 120);
}

function formatError(err: ApiClientError) {
  return `${err.code}: ${err.message}`;
}

export default function AutomationLogsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [scope, setScope] = useState("");
  const [status, setStatus] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const [items, setItems] = useState<AutomationLog[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [canRun, setCanRun] = useState(false);

  const [detailOpen, setDetailOpen] = useState(false);
  const [selected, setSelected] = useState<AutomationLog | null>(null);
  const [tab, setTab] = useState<"input" | "output" | "error">("input");

  const query = useMemo(() => {
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("pageSize", String(pageSize));
    if (scope) params.set("scope", scope);
    if (status) params.set("status", status);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    return params.toString();
  }, [from, page, pageSize, scope, status, to]);

  useEffect(() => {
    const scopeQ = searchParams.get("scope") || "";
    const hl = searchParams.get("hl") || "";
    if (scopeQ) setScope(scopeQ);
    if (hl) {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [searchParams]);

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

  const loadLogs = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    setLoading(true);
    setError("");
    try {
      const data = await fetchJson<LogsResponse>(`/api/automation/logs?${query}`, { token });
      setItems(data.items);
      setTotal(data.total);
    } catch (e) {
      const err = e as ApiClientError;
      if (!handleAuthError(err)) setError(formatError(err));
    } finally {
      setLoading(false);
    }
  }, [handleAuthError, query]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  useEffect(() => {
    fetchMe()
      .then((data) => setCanRun(isAdminRole(data.user.role)))
      .catch(() => setCanRun(false));
  }, []);

  async function retryRun(log: AutomationLog) {
    if (!canRun) return;
    const token = getToken();
    if (!token) return;
    setError("");
    setSuccess("");
    const payload = parsePayload(log.payload);
    const scopeValue = log.milestone === "daily" ? "daily" : "manual";

    try {
      const result = await fetchJson<{ log: AutomationLog }>("/api/automation/run", {
        method: "POST",
        token,
        body: {
          scope: scopeValue,
          leadId: log.leadId || payload.input?.leadId || undefined,
          studentId: log.studentId || payload.input?.studentId || undefined,
          dryRun: false,
        },
      });
      setSuccess("Đã chạy lại automation.");
      await loadLogs();
      router.replace(`/automation/logs?scope=${scopeValue}&hl=${result.log.id}`);
    } catch (e) {
      const err = e as ApiClientError;
      if (!handleAuthError(err)) setError(formatError(err));
    }
  }

  const highlightId = searchParams.get("hl") || "";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-zinc-900">Nhật ký Automation</h1>
        <Button variant="secondary" onClick={loadLogs} disabled={loading}>
          {loading ? (
            <span className="flex items-center gap-2">
              <Spinner /> Đang tải...
            </span>
          ) : (
            "Làm mới"
          )}
        </Button>
      </div>

      {error ? <Alert type="error" message={error} /> : null}
      {success ? <Alert type="success" message={success} /> : null}

      <div className="grid gap-2 rounded-xl bg-white p-4 shadow-sm md:grid-cols-5">
        <Select value={scope} onChange={(e) => { setScope(e.target.value); setPage(1); }}>
          <option value="">Tất cả phạm vi</option>
          <option value="daily">Daily</option>
          <option value="manual">Manual</option>
        </Select>
        <Select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
          <option value="">Tất cả trạng thái</option>
          <option value="sent">Đã gửi</option>
          <option value="failed">Thất bại</option>
          <option value="skipped">Bỏ qua</option>
        </Select>
        <Input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} />
        <Input type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} />
        <Select value={String(pageSize)} onChange={(e) => { setPage(1); setPageSize(Number(e.target.value)); }}>
          <option value="20">20 / trang</option>
          <option value="50">50 / trang</option>
          <option value="100">100 / trang</option>
        </Select>
      </div>

      {loading ? (
        <div className="rounded-xl bg-white p-6 text-sm text-zinc-600">Đang tải nhật ký automation...</div>
      ) : items.length === 0 ? (
        <div className="rounded-xl bg-white p-6 text-sm text-zinc-600">Không có dữ liệu.</div>
      ) : (
        <Table headers={["Thời gian gửi", "Phạm vi", "Trạng thái", "Runtime", "Đối tượng", "Lỗi", "Hành động"]}>
          {items.map((item) => {
            const payload = parsePayload(item.payload);
            const runtime = payload.runtimeStatus;
            const canRetry = canRun && (runtime === "failed" || item.status === "failed");

            return (
              <tr key={item.id} className={`border-t border-zinc-100 ${highlightId === item.id ? "bg-amber-50" : ""}`}>
                <td className="px-3 py-2 text-sm text-zinc-700">{formatDateTimeVi(item.sentAt)}</td>
                <td className="px-3 py-2">{item.milestone}</td>
                <td className="px-3 py-2"><Badge text={statusLabel(item.status)} /></td>
                <td className="px-3 py-2"><Badge text={runtimeLabel(runtime)} /></td>
                <td className="px-3 py-2 text-xs text-zinc-700">
                  {item.leadId ? `Khách hàng: ${item.leadId}` : ""}
                  {item.leadId && item.studentId ? " | " : ""}
                  {item.studentId ? `Học viên: ${item.studentId}` : "-"}
                </td>
                <td className="max-w-[260px] px-3 py-2 text-xs text-zinc-600">{shortError(payload)}</td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="secondary"
                      className="h-7 px-2 py-1 text-xs"
                      onClick={() => {
                        setSelected(item);
                        setTab("input");
                        setDetailOpen(true);
                      }}
                    >
                      Xem
                    </Button>
                    {canRetry ? (
                      <Button className="h-7 px-2 py-1 text-xs" onClick={() => retryRun(item)}>
                        Chạy lại
                      </Button>
                    ) : null}
                  </div>
                </td>
              </tr>
            );
          })}
        </Table>
      )}

      <Pagination page={page} pageSize={pageSize} total={total} onPageChange={setPage} />

      <Modal open={detailOpen} title="Chi tiết nhật ký" onClose={() => setDetailOpen(false)}>
        {selected ? (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Button variant={tab === "input" ? "primary" : "secondary"} onClick={() => setTab("input")}>Input</Button>
              <Button variant={tab === "output" ? "primary" : "secondary"} onClick={() => setTab("output")}>Output</Button>
              <Button variant={tab === "error" ? "primary" : "secondary"} onClick={() => setTab("error")}>Lỗi</Button>
            </div>
            {(() => {
              const payload = parsePayload(selected.payload);
              const data = tab === "input" ? payload.input ?? {} : tab === "output" ? payload.output ?? {} : payload.error ?? {};
              return (
                <pre className="max-h-[420px] overflow-auto rounded-lg bg-zinc-900 p-3 text-xs text-zinc-100">
                  {JSON.stringify(data, null, 2)}
                </pre>
              );
            })()}
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
