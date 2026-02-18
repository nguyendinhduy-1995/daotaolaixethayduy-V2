"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { fetchJson, type ApiClientError } from "@/lib/api-client";
import { clearToken, getToken } from "@/lib/auth-client";
import { Alert } from "@/components/ui/alert";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Pagination } from "@/components/ui/pagination";
import { Select } from "@/components/ui/select";
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

type TemplateItem = {
  id: string;
  key: string;
  title: string;
  channel: "ZALO" | "FB" | "SMS" | "CALL_NOTE";
  body: string;
};

function scopeLabel(scope: NotificationItem["scope"]) {
  const map = { FINANCE: "💰 Tài chính", FOLLOWUP: "👤 Chăm sóc", SCHEDULE: "📅 Lịch học", SYSTEM: "⚙️ Hệ thống" } as Record<string, string>;
  return map[scope] || scope;
}
const SCOPE_STYLE: Record<string, { bg: string; text: string; border: string }> = {
  FINANCE: { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200" },
  FOLLOWUP: { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200" },
  SCHEDULE: { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200" },
  SYSTEM: { bg: "bg-zinc-100", text: "text-zinc-700", border: "border-zinc-200" },
};
function statusLabel(status: NotificationItem["status"]) {
  const map = { NEW: "🆕 Mới", DOING: "⏳ Đang xử lý", DONE: "✅ Hoàn thành", SKIPPED: "⏭️ Bỏ qua" } as Record<string, string>;
  return map[status] || status;
}
const STATUS_STYLE: Record<string, { bg: string; text: string; border: string }> = {
  NEW: { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200" },
  DOING: { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200" },
  DONE: { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200" },
  SKIPPED: { bg: "bg-zinc-100", text: "text-zinc-600", border: "border-zinc-200" },
};
function priorityLabel(priority: NotificationItem["priority"]) {
  const map = { HIGH: "🔴 Cao", MEDIUM: "🟡 Trung bình", LOW: "🟢 Thấp" } as Record<string, string>;
  return map[priority] || priority;
}
const PRIORITY_STYLE: Record<string, { bg: string; text: string; border: string }> = {
  HIGH: { bg: "bg-red-50", text: "text-red-700", border: "border-red-200" },
  MEDIUM: { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200" },
  LOW: { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200" },
};
export default function NotificationsPage() {
  const router = useRouter();
  const toast = useToast();
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
  const [sendItem, setSendItem] = useState<NotificationItem | null>(null);
  const [sendChannel, setSendChannel] = useState<"ZALO" | "FB" | "SMS" | "CALL_NOTE">("SMS");
  const [templates, setTemplates] = useState<TemplateItem[]>([]);
  const [selectedTemplateKey, setSelectedTemplateKey] = useState("");
  const [variablesText, setVariablesText] = useState("{}");
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

  async function loadTemplates(channel: "ZALO" | "FB" | "SMS" | "CALL_NOTE") {
    const token = getToken();
    if (!token) return;
    try {
      const data = await fetchJson<{ items: TemplateItem[] }>(`/api/templates?channel=${channel}`, { token });
      setTemplates(data.items);
      setSelectedTemplateKey(data.items[0]?.key || "");
    } catch {
      setTemplates([]);
      setSelectedTemplateKey("");
    }
  }

  useEffect(() => {
    if (!sendItem) return;
    loadTemplates(sendChannel);
  }, [sendChannel, sendItem]);

  function previewRenderedText() {
    const template = templates.find((item) => item.key === selectedTemplateKey);
    if (!template) return "";
    let vars: Record<string, unknown> = {};
    try {
      vars = JSON.parse(variablesText || "{}");
    } catch {
      vars = {};
    }
    const merged: Record<string, unknown> = {
      name: sendItem?.student?.lead.fullName || sendItem?.lead?.fullName || "",
      ...(vars || {}),
    };
    return template.body.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key: string) => String(merged[key] ?? ""));
  }

  async function sendReminder() {
    if (!sendItem) return;
    const token = getToken();
    if (!token) return;
    if (!selectedTemplateKey) {
      setError("Vui lòng chọn mẫu tin.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      let variables: Record<string, unknown> = {};
      try {
        variables = JSON.parse(variablesText || "{}");
      } catch {
        return setError("Biến mẫu không đúng định dạng JSON.");
      }
      await fetchJson("/api/outbound/messages", {
        method: "POST",
        token,
        body: {
          channel: sendChannel,
          templateKey: selectedTemplateKey,
          notificationId: sendItem.id,
          leadId: sendItem.leadId || undefined,
          studentId: sendItem.studentId || undefined,
          variables,
        },
      });
      toast.success("Đã đưa tin nhắn vào hàng đợi.");
      setSendItem(null);
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
      {/* ── Premium Header ── */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-rose-600 via-pink-600 to-fuchsia-600 p-4 text-white shadow-lg shadow-rose-200 animate-fadeInUp">
        <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-white/10 blur-2xl" />
        <div className="absolute -bottom-4 -left-4 h-20 w-20 rounded-full bg-white/10 blur-xl" />
        <div className="relative flex flex-wrap items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/20 text-2xl backdrop-blur-sm">🔔</div>
          <div className="flex-1">
            <h2 className="text-lg font-bold">Thông báo</h2>
            <p className="text-sm text-white/80">Theo dõi nhiệm vụ & gửi nhắc nhở</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-white/20 px-3 py-1 text-sm font-bold backdrop-blur-sm">
              📊 {total}
            </span>
            <Button variant="secondary" onClick={loadItems} disabled={loading} className="!bg-white/20 !text-white !border-white/30 hover:!bg-white/30">
              {loading ? "Đang tải..." : "Làm mới"}
            </Button>
          </div>
        </div>
      </div>

      {error ? <Alert type="error" message={error} /> : null}

      {/* ── Filters ── */}
      <div className="overflow-hidden rounded-2xl border border-zinc-100 bg-white shadow-sm animate-fadeInUp" style={{ animationDelay: "80ms" }}>
        <div className="h-1 bg-gradient-to-r from-rose-500 to-pink-500" />
        <div className="grid gap-2 p-4 md:grid-cols-3 lg:grid-cols-6">
          <Select value={scope} onChange={(e) => { setScope(e.target.value); setPage(1); }}>
            <option value="">Tất cả loại</option>
            <option value="FINANCE">💰 Tài chính</option>
            <option value="FOLLOWUP">👤 Chăm sóc</option>
            <option value="SCHEDULE">📅 Lịch học</option>
            <option value="SYSTEM">⚙️ Hệ thống</option>
          </Select>
          <Select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
            <option value="">Tất cả trạng thái</option>
            <option value="NEW">🆕 Mới</option>
            <option value="DOING">⏳ Đang xử lý</option>
            <option value="DONE">✅ Hoàn thành</option>
            <option value="SKIPPED">⏭️ Bỏ qua</option>
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
      </div>

      {loading ? (
        <div className="animate-pulse space-y-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center gap-3 rounded-xl bg-white p-3 shadow-sm">
              <div className="h-9 w-9 rounded-full bg-zinc-200" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-1/3 rounded bg-zinc-200" />
                <div className="h-3 w-2/3 rounded bg-zinc-100" />
              </div>
              <div className="h-6 w-20 rounded-full bg-zinc-200" />
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-zinc-200 bg-white p-8 text-center animate-fadeInUp">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-zinc-100 text-2xl">🔕</div>
          <p className="font-medium text-zinc-700">Không có dữ liệu</p>
          <p className="mt-1 text-sm text-zinc-500">Không có thông báo phù hợp với bộ lọc.</p>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="overflow-hidden rounded-2xl border border-zinc-100 bg-white shadow-sm animate-fadeInUp" style={{ animationDelay: "160ms" }}>
            <Table headers={["Loại", "Ưu tiên", "Tiêu đề", "Hạn xử lý", "Trạng thái", "Liên quan", "Hành động"]}>
              {items.map((item, idx) => {
                const sc = SCOPE_STYLE[item.scope] || SCOPE_STYLE.SYSTEM;
                const st = STATUS_STYLE[item.status] || STATUS_STYLE.NEW;
                const pr = PRIORITY_STYLE[item.priority] || PRIORITY_STYLE.LOW;
                return (
                  <tr key={item.id} className="border-t border-zinc-100 transition-colors hover:bg-zinc-50 animate-fadeInUp" style={{ animationDelay: `${160 + Math.min(idx * 40, 300)}ms` }}>
                    <td className="px-3 py-2">
                      <span className={`inline-flex items-center rounded-full ${sc.bg} ${sc.text} border ${sc.border} px-2 py-0.5 text-xs font-bold`}>
                        {scopeLabel(item.scope)}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <span className={`inline-flex items-center rounded-full ${pr.bg} ${pr.text} border ${pr.border} px-2 py-0.5 text-xs font-bold`}>
                        {priorityLabel(item.priority)}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <p className="font-medium text-zinc-900">{item.title}</p>
                      <p className="text-xs text-zinc-500 line-clamp-1">{item.message}</p>
                    </td>
                    <td className="px-3 py-2 text-sm text-zinc-700">{item.dueAt ? formatDateTimeVi(item.dueAt) : "-"}</td>
                    <td className="px-3 py-2">
                      <span className={`inline-flex items-center rounded-full ${st.bg} ${st.text} border ${st.border} px-2 py-0.5 text-xs font-bold`}>
                        {statusLabel(item.status)}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-sm text-zinc-700">
                      {item.studentId ? (
                        <Link href={`/students/${item.studentId}`} className="text-blue-700 hover:underline">
                          🎓 {item.student?.lead.fullName || item.studentId}
                        </Link>
                      ) : item.leadId ? (
                        <Link href={`/leads/${item.leadId}`} className="text-blue-700 hover:underline">
                          👤 {item.lead?.fullName || item.leadId}
                        </Link>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-1">
                        <Button variant="secondary" className="!text-xs !px-2" onClick={() => setDetailItem(item)}>Xem</Button>
                        <Button variant="secondary" className="!text-xs !px-2" onClick={() => patchNotification(item.id, { status: "DONE" })} disabled={saving}>
                          ✅
                        </Button>
                        <Button
                          variant="secondary"
                          className="!text-xs !px-2"
                          onClick={() => {
                            setSendItem(item);
                            setSendChannel("SMS");
                            setVariablesText("{}");
                          }}
                        >
                          📨
                        </Button>
                        <Button variant="secondary" className="!text-xs !px-2" onClick={() => { setRescheduleItem(item); setRescheduleDate(item.dueAt ? item.dueAt.slice(0, 10) : ""); }}>
                          📅
                        </Button>
                        <Button variant="secondary" className="!text-xs !px-2" onClick={() => patchNotification(item.id, { status: "SKIPPED" })} disabled={saving}>
                          ⏭️
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </Table>
          </div>
          <Pagination page={page} pageSize={pageSize} total={total} onPageChange={setPage} />
        </div>
      )}

      <Modal open={Boolean(detailItem)} title="🔔 Chi tiết thông báo" onClose={() => setDetailItem(null)}>
        {detailItem ? (
          <div className="space-y-3">
            <div className="overflow-hidden rounded-xl border border-zinc-100">
              <div className="h-1 bg-gradient-to-r from-rose-500 to-pink-500" />
              <div className="p-3 space-y-2">
                <p className="text-sm font-bold text-zinc-900">{detailItem.title}</p>
                <p className="text-sm text-zinc-700">{detailItem.message}</p>
                <div className="flex gap-2">
                  <span className={`inline-flex items-center rounded-full ${(SCOPE_STYLE[detailItem.scope] || SCOPE_STYLE.SYSTEM).bg} ${(SCOPE_STYLE[detailItem.scope] || SCOPE_STYLE.SYSTEM).text} px-2 py-0.5 text-xs font-bold`}>
                    {scopeLabel(detailItem.scope)}
                  </span>
                  <span className={`inline-flex items-center rounded-full ${(STATUS_STYLE[detailItem.status] || STATUS_STYLE.NEW).bg} ${(STATUS_STYLE[detailItem.status] || STATUS_STYLE.NEW).text} px-2 py-0.5 text-xs font-bold`}>
                    {statusLabel(detailItem.status)}
                  </span>
                </div>
                <p className="text-xs text-zinc-500">📅 {formatDateTimeVi(detailItem.createdAt)}</p>
              </div>
            </div>
            {detailItem.payload ? (
              <pre className="overflow-auto rounded-xl border border-zinc-100 bg-zinc-50 p-3 text-xs text-zinc-700">{JSON.stringify(detailItem.payload, null, 2)}</pre>
            ) : null}
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

      <Modal open={Boolean(sendItem)} title="Gửi nhắc khách hàng" onClose={() => setSendItem(null)}>
        <div className="space-y-3">
          <Select value={sendChannel} onChange={(e) => setSendChannel(e.target.value as "ZALO" | "FB" | "SMS" | "CALL_NOTE")}>
            <option value="SMS">SMS</option>
            <option value="ZALO">Zalo</option>
            <option value="FB">Facebook</option>
            <option value="CALL_NOTE">Ghi chú gọi</option>
          </Select>
          <Select value={selectedTemplateKey} onChange={(e) => setSelectedTemplateKey(e.target.value)}>
            <option value="">Chọn mẫu tin</option>
            {templates.map((tpl) => (
              <option key={tpl.id} value={tpl.key}>
                {tpl.title} ({tpl.key})
              </option>
            ))}
          </Select>
          <Input value={variablesText} onChange={(e) => setVariablesText(e.target.value)} placeholder='{"remaining": 1000000}' />
          <div className="rounded bg-zinc-50 p-3 text-sm text-zinc-700">
            <p className="mb-1 font-medium text-zinc-900">Xem trước nội dung</p>
            <p>{previewRenderedText() || "-"}</p>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setSendItem(null)}>
              Hủy
            </Button>
            <Button onClick={sendReminder} disabled={saving}>
              {saving ? "Đang gửi..." : "Xác nhận gửi"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
