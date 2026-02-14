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
import { Pagination } from "@/components/ui/pagination";
import { Select } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Table } from "@/components/ui/table";
import { formatDateTimeVi } from "@/lib/date-utils";

type OutboundItem = {
  id: string;
  channel: "ZALO" | "FB" | "SMS" | "CALL_NOTE";
  to: string | null;
  templateKey: string;
  renderedText: string;
  status: "QUEUED" | "SENT" | "FAILED" | "SKIPPED";
  error: string | null;
  retryCount: number;
  nextAttemptAt: string | null;
  providerMessageId: string | null;
  leadId: string | null;
  studentId: string | null;
  createdAt: string;
  sentAt: string | null;
  lead?: { id: string; fullName: string | null } | null;
  student?: { id: string; lead: { id: string; fullName: string | null } } | null;
};

type OutboundListResponse = {
  items: OutboundItem[];
  page: number;
  pageSize: number;
  total: number;
};

function channelLabel(channel: OutboundItem["channel"]) {
  if (channel === "ZALO") return "Zalo";
  if (channel === "FB") return "Facebook";
  if (channel === "SMS") return "SMS";
  return "Ghi chú gọi";
}

function statusLabel(status: OutboundItem["status"]) {
  if (status === "QUEUED") return "Đang chờ";
  if (status === "SENT") return "Đã gửi";
  if (status === "FAILED") return "Thất bại";
  return "Bỏ qua";
}

export default function OutboundPage() {
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState(false);
  const [items, setItems] = useState<OutboundItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [status, setStatus] = useState("");
  const [channel, setChannel] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [qInput, setQInput] = useState("");
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [dispatching, setDispatching] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const query = useMemo(() => {
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("pageSize", String(pageSize));
    if (status) params.set("status", status);
    if (channel) params.set("channel", channel);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    if (q.trim()) params.set("q", q.trim());
    return params.toString();
  }, [channel, from, page, pageSize, q, status, to]);

  const handleAuthError = useCallback((err: ApiClientError) => {
    if (err.code === "AUTH_MISSING_BEARER" || err.code === "AUTH_INVALID_TOKEN") {
      clearToken();
      router.replace("/login");
      return true;
    }
    return false;
  }, [router]);

  useEffect(() => {
    fetchMe()
      .then((data) => setIsAdmin(isAdminRole(data.user.role)))
      .catch(() => setIsAdmin(false));
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setQ(qInput);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [qInput]);

  const loadItems = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    setLoading(true);
    setError("");
    try {
      const data = await fetchJson<OutboundListResponse>(`/api/outbound/messages?${query}`, { token });
      setItems(data.items);
      setTotal(data.total);
    } catch (e) {
      const err = e as ApiClientError;
      if (!handleAuthError(err)) setError(`${err.code}: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, [handleAuthError, query]);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  async function dispatchQueue() {
    const token = getToken();
    if (!token) return;
    setDispatching(true);
    setError("");
    setSuccess("");
    try {
      const data = await fetchJson<{ total: number; accepted: number; failed: number; webhookEnabled: boolean }>("/api/outbound/dispatch", {
        method: "POST",
        token,
        body: { limit: 20 },
      });
      const modeText = data.webhookEnabled ? "đẩy webhook" : "mock local";
      setSuccess(`Đã xử lý ${data.total} tin (${modeText}), nhận xử lý ${data.accepted}, lỗi ${data.failed}.`);
      await loadItems();
    } catch (e) {
      const err = e as ApiClientError;
      if (!handleAuthError(err)) setError(`${err.code}: ${err.message}`);
    } finally {
      setDispatching(false);
    }
  }

  async function retryFailed() {
    const token = getToken();
    if (!token) return;
    setRetrying(true);
    setError("");
    setSuccess("");
    try {
      const data = await fetchJson<{ total: number; accepted: number; failed: number; webhookEnabled: boolean }>("/api/outbound/dispatch", {
        method: "POST",
        token,
        body: { limit: 20, retryFailedOnly: true },
      });
      const modeText = data.webhookEnabled ? "đẩy webhook" : "mock local";
      setSuccess(`Đã thử gửi lại ${data.total} tin lỗi (${modeText}), nhận xử lý ${data.accepted}, lỗi ${data.failed}.`);
      await loadItems();
    } catch (e) {
      const err = e as ApiClientError;
      if (!handleAuthError(err)) setError(`${err.code}: ${err.message}`);
    } finally {
      setRetrying(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-zinc-900">Gửi tin</h1>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={loadItems} disabled={loading}>
            {loading ? "Đang tải..." : "Làm mới"}
          </Button>
          {isAdmin ? (
            <>
              <Button onClick={dispatchQueue} disabled={dispatching}>
                {dispatching ? "Đang gửi..." : "Gửi hàng đợi"}
              </Button>
              <Button variant="secondary" onClick={retryFailed} disabled={retrying}>
                {retrying ? "Đang thử lại..." : "Gửi lại lỗi"}
              </Button>
            </>
          ) : null}
        </div>
      </div>
      <p className="text-xs text-zinc-500">
        Nếu chưa cấu hình `N8N_WEBHOOK_URL`, hệ thống sẽ gửi mock local và tự đánh dấu thành công.
      </p>

      {error ? <Alert type="error" message={error} /> : null}
      {success ? <Alert type="success" message={success} /> : null}

      <div className="grid gap-2 rounded-xl bg-white p-4 shadow-sm md:grid-cols-3 lg:grid-cols-6">
        <Select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
          <option value="">Tất cả trạng thái</option>
          <option value="QUEUED">Đang chờ</option>
          <option value="SENT">Đã gửi</option>
          <option value="FAILED">Thất bại</option>
          <option value="SKIPPED">Bỏ qua</option>
        </Select>
        <Select value={channel} onChange={(e) => { setChannel(e.target.value); setPage(1); }}>
          <option value="">Tất cả kênh</option>
          <option value="ZALO">Zalo</option>
          <option value="FB">Facebook</option>
          <option value="SMS">SMS</option>
          <option value="CALL_NOTE">Ghi chú gọi</option>
        </Select>
        <Input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} />
        <Input type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} />
        <Input placeholder="Tìm nội dung/template/số nhận" value={qInput} onChange={(e) => setQInput(e.target.value)} />
        <Select value={String(pageSize)} onChange={(e) => { setPage(1); setPageSize(Number(e.target.value)); }}>
          <option value="20">20 / trang</option>
          <option value="50">50 / trang</option>
          <option value="100">100 / trang</option>
        </Select>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-zinc-700">
          <Spinner /> Đang tải...
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-xl bg-white p-6 text-sm text-zinc-600 shadow-sm">Không có dữ liệu</div>
      ) : (
        <div className="space-y-3">
          <Table headers={["Kênh", "Template", "Người nhận", "Trạng thái", "Lần thử", "Lần gửi", "Mã nhà cung cấp", "Liên quan", "Nội dung", "Lỗi", "Thời gian"]}>
            {items.map((item) => (
              <tr key={item.id} className="border-t border-zinc-100">
                <td className="px-3 py-2"><Badge text={channelLabel(item.channel)} /></td>
                <td className="px-3 py-2 text-sm text-zinc-700">{item.templateKey}</td>
                <td className="px-3 py-2 text-sm text-zinc-700">{item.to || "-"}</td>
                <td className="px-3 py-2">
                  <Badge text={statusLabel(item.status)} />
                </td>
                <td className="px-3 py-2 text-sm text-zinc-700">{item.retryCount}</td>
                <td className="px-3 py-2 text-xs text-zinc-600">{item.nextAttemptAt ? formatDateTimeVi(item.nextAttemptAt) : "-"}</td>
                <td className="px-3 py-2 text-xs text-zinc-600">{item.providerMessageId || "-"}</td>
                <td className="px-3 py-2 text-sm">
                  {item.studentId ? (
                    <Link href={`/students/${item.studentId}`} className="text-blue-700 hover:underline">
                      Học viên: {item.student?.lead.fullName || item.studentId}
                    </Link>
                  ) : item.leadId ? (
                    <Link href={`/leads/${item.leadId}`} className="text-blue-700 hover:underline">
                      Khách hàng: {item.lead?.fullName || item.leadId}
                    </Link>
                  ) : (
                    "-"
                  )}
                </td>
                <td className="px-3 py-2 text-sm text-zinc-700">{item.renderedText}</td>
                <td className="px-3 py-2 text-xs text-red-600">{item.error || "-"}</td>
                <td className="px-3 py-2 text-xs text-zinc-600">
                  <div>Tạo: {formatDateTimeVi(item.createdAt)}</div>
                  <div>Gửi: {item.sentAt ? formatDateTimeVi(item.sentAt) : "-"}</div>
                </td>
              </tr>
            ))}
          </Table>
          <Pagination page={page} pageSize={pageSize} total={total} onPageChange={setPage} />
        </div>
      )}
    </div>
  );
}
