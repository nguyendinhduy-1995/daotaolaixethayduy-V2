"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { fetchJson, type ApiClientError } from "@/lib/api-client";
import { clearToken, getToken } from "@/lib/auth-client";
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

type NotificationItem = {
  id: string;
  scope: "FINANCE" | "FOLLOWUP" | "SCHEDULE" | "SYSTEM";
  status: "NEW" | "DOING" | "DONE" | "SKIPPED";
  priority: "HIGH" | "MEDIUM" | "LOW";
  title: string;
  message: string;
  payload?: unknown;
  leadId: string | null;
  studentId: string | null;
  ownerId: string | null;
  dueAt: string | null;
  createdAt: string;
  lead?: { id: string; fullName: string | null; phone: string | null } | null;
  student?: { id: string; lead: { id: string; fullName: string | null; phone: string | null } } | null;
};

type NotificationListResponse = {
  items: NotificationItem[];
  page: number;
  pageSize: number;
  total: number;
};

function scopeLabel(scope: NotificationItem["scope"]) {
  if (scope === "FINANCE") return "Tài chính";
  if (scope === "FOLLOWUP") return "Chăm sóc";
  if (scope === "SCHEDULE") return "Lịch học";
  return "Hệ thống";
}

function statusLabel(status: NotificationItem["status"]) {
  if (status === "NEW") return "Mới";
  if (status === "DOING") return "Đang xử lý";
  if (status === "DONE") return "Hoàn thành";
  return "Bỏ qua";
}

function priorityLabel(priority: NotificationItem["priority"]) {
  if (priority === "HIGH") return "Cao";
  if (priority === "MEDIUM") return "Trung bình";
  return "Thấp";
}

export default function NotificationsPage() {
  const router = useRouter();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [scope, setScope] = useState("");
  const [status, setStatus] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [qInput, setQInput] = useState("");
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [detailItem, setDetailItem] = useState<NotificationItem | null>(null);
  const [rescheduleItem, setRescheduleItem] = useState<NotificationItem | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [saving, setSaving] = useState(false);

  const query = useMemo(() => {
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("pageSize", String(pageSize));
    if (scope) params.set("scope", scope);
    if (status) params.set("status", status);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    if (q.trim()) params.set("q", q.trim());
    return params.toString();
  }, [from, page, pageSize, q, scope, status, to]);

  const handleAuthError = useCallback((err: ApiClientError) => {
    if (err.code === "AUTH_MISSING_BEARER" || err.code === "AUTH_INVALID_TOKEN") {
      clearToken();
      router.replace("/login");
      return true;
    }
    return false;
  }, [router]);

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
      const data = await fetchJson<NotificationListResponse>(`/api/notifications?${query}`, { token });
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

  async function patchNotification(id: string, body: { status?: string; dueAt?: string | null }) {
    const token = getToken();
    if (!token) return;
    setSaving(true);
    setError("");
    try {
      await fetchJson(`/api/notifications/${id}`, { method: "PATCH", token, body });
      setRescheduleItem(null);
      setRescheduleDate("");
      await loadItems();
    } catch (e) {
      const err = e as ApiClientError;
      if (!handleAuthError(err)) setError(`${err.code}: ${err.message}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-zinc-900">Thông báo</h1>
        <Button variant="secondary" onClick={loadItems} disabled={loading}>
          {loading ? "Đang tải..." : "Làm mới"}
        </Button>
      </div>

      {error ? <Alert type="error" message={error} /> : null}

      <div className="grid gap-2 rounded-xl bg-white p-4 shadow-sm md:grid-cols-3 lg:grid-cols-6">
        <Select value={scope} onChange={(e) => { setScope(e.target.value); setPage(1); }}>
          <option value="">Tất cả loại</option>
          <option value="FINANCE">Tài chính</option>
          <option value="FOLLOWUP">Chăm sóc</option>
          <option value="SCHEDULE">Lịch học</option>
          <option value="SYSTEM">Hệ thống</option>
        </Select>
        <Select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
          <option value="">Tất cả trạng thái</option>
          <option value="NEW">Mới</option>
          <option value="DOING">Đang xử lý</option>
          <option value="DONE">Hoàn thành</option>
          <option value="SKIPPED">Bỏ qua</option>
        </Select>
        <Input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} />
        <Input type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} />
        <Input placeholder="Tìm tiêu đề/nội dung" value={qInput} onChange={(e) => setQInput(e.target.value)} />
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
          <Table headers={["Loại", "Ưu tiên", "Tiêu đề", "Hạn xử lý", "Trạng thái", "Liên quan", "Hành động"]}>
            {items.map((item) => (
              <tr key={item.id} className="border-t border-zinc-100">
                <td className="px-3 py-2"><Badge text={scopeLabel(item.scope)} /></td>
                <td className="px-3 py-2"><Badge text={priorityLabel(item.priority)} /></td>
                <td className="px-3 py-2">
                  <p className="font-medium text-zinc-900">{item.title}</p>
                  <p className="text-xs text-zinc-600">{item.message}</p>
                </td>
                <td className="px-3 py-2 text-sm text-zinc-700">{item.dueAt ? formatDateTimeVi(item.dueAt) : "-"}</td>
                <td className="px-3 py-2"><Badge text={statusLabel(item.status)} /></td>
                <td className="px-3 py-2 text-sm text-zinc-700">
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
                <td className="px-3 py-2">
                  <div className="flex flex-wrap gap-2">
                    <Button variant="secondary" onClick={() => setDetailItem(item)}>Xem</Button>
                    <Button variant="secondary" onClick={() => patchNotification(item.id, { status: "DONE" })} disabled={saving}>
                      Đánh dấu xong
                    </Button>
                    <Button variant="secondary" onClick={() => { setRescheduleItem(item); setRescheduleDate(item.dueAt ? item.dueAt.slice(0, 10) : ""); }}>
                      Hẹn lại
                    </Button>
                    <Button variant="secondary" onClick={() => patchNotification(item.id, { status: "SKIPPED" })} disabled={saving}>
                      Bỏ qua
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </Table>
          <Pagination page={page} pageSize={pageSize} total={total} onPageChange={setPage} />
        </div>
      )}

      <Modal open={Boolean(detailItem)} title="Chi tiết thông báo" onClose={() => setDetailItem(null)}>
        {detailItem ? (
          <div className="space-y-2">
            <p className="text-sm text-zinc-700"><span className="font-semibold">Tiêu đề: </span>{detailItem.title}</p>
            <p className="text-sm text-zinc-700"><span className="font-semibold">Nội dung: </span>{detailItem.message}</p>
            <p className="text-sm text-zinc-700"><span className="font-semibold">Tạo lúc: </span>{formatDateTimeVi(detailItem.createdAt)}</p>
            <pre className="overflow-auto rounded bg-zinc-50 p-2 text-xs text-zinc-700">{JSON.stringify(detailItem.payload, null, 2)}</pre>
          </div>
        ) : null}
      </Modal>

      <Modal open={Boolean(rescheduleItem)} title="Hẹn lại hạn xử lý" onClose={() => setRescheduleItem(null)}>
        <div className="space-y-3">
          <Input type="date" value={rescheduleDate} onChange={(e) => setRescheduleDate(e.target.value)} />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setRescheduleItem(null)}>
              Hủy
            </Button>
            <Button
              onClick={() => {
                if (!rescheduleItem) return;
                void patchNotification(rescheduleItem.id, { dueAt: rescheduleDate || null, status: "DOING" });
              }}
              disabled={saving}
            >
              {saving ? "Đang lưu..." : "Lưu"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
